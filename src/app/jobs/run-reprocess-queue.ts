import { randomUUID } from "node:crypto";
import { loadSettings } from "../../config/settings.js";
import { IntegrationError } from "../../domain/errors/integration-error.js";
import type { SalesOrder } from "../../domain/models/order.js";
import type {
  CreatedPickup,
  PickupRequestPayload,
} from "../../domain/models/pickup.js";
import { EligibilityService } from "../../domain/services/eligibility-service.js";
import { IdempotencyService } from "../../domain/services/idempotency-service.js";
import { OrderNormalizer } from "../../domain/services/order-normalizer.js";
import { PickupPayloadBuilder } from "../../domain/services/pickup-payload-builder.js";
import { PickupValidator } from "../../domain/validators/pickup-validator.js";
import { FetchHttpClient } from "../../infrastructure/http/fetch-http-client.js";
import { JtClient } from "../../infrastructure/http/jt-client.js";
import { JtSignatureService } from "../../infrastructure/http/jt-signature-service.js";
import { sanitizeForLogging } from "../../infrastructure/logging/sanitizer.js";
import { createPostgresDatabase } from "../../infrastructure/persistence/postgres/postgres-database.js";
import { PostgresOperationalIssuesRepository } from "../../infrastructure/persistence/postgres/postgres-operational-issues-repository.js";
import { PostgresOrderProcessingEventsRepository } from "../../infrastructure/persistence/postgres/postgres-order-processing-events-repository.js";
import { PostgresPickupRequestsRepository } from "../../infrastructure/persistence/postgres/postgres-pickup-requests-repository.js";
import { toJsonb } from "../../infrastructure/persistence/postgres/json.js";

interface ReprocessRequestRow {
  id: string;
  branch_code: number;
  order_code: string | number;
  txlogistic_id: string | null;
  jt_send_enabled: boolean;
  force_send: boolean;
  reason: string;
}

interface StoredOrderRow {
  raw_order: SalesOrder;
}

interface OrderOverrideRow {
  id: string;
  patch: Record<string, unknown>;
}

type ReprocessAttemptStatus =
  | "succeeded"
  | "failed"
  | "dry-run"
  | "already-created";

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getArgValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeDeep(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    const current = merged[key];
    merged[key] = isRecord(current) && isRecord(value) ? mergeDeep(current, value) : value;
  }

  return merged;
}

function applyOverride(order: SalesOrder, override?: OrderOverrideRow): SalesOrder {
  if (!override) {
    return order;
  }

  return mergeDeep(
    order as unknown as Record<string, unknown>,
    override.patch,
  ) as unknown as SalesOrder;
}

function buildTxlogisticId(request: ReprocessRequestRow, order: SalesOrder): string {
  return request.txlogistic_id ?? `${order.branchCode}-${order.orderCode}`;
}

async function loadPendingRequests(
  db: ReturnType<typeof createPostgresDatabase>,
  limit: number,
): Promise<ReprocessRequestRow[]> {
  const result = await db.query<ReprocessRequestRow>(
    `
      SELECT
        id,
        branch_code,
        order_code,
        txlogistic_id,
        jt_send_enabled,
        force_send,
        reason
      FROM reprocess_requests
      WHERE status = 'pending'
      ORDER BY created_at
      LIMIT $1
    `,
    [limit],
  );

  return result.rows;
}

async function markRunning(
  db: ReturnType<typeof createPostgresDatabase>,
  requestId: string,
): Promise<ReprocessRequestRow | null> {
  const result = await db.query<ReprocessRequestRow>(
    `
      UPDATE reprocess_requests
      SET
        status = 'running',
        started_at = COALESCE(started_at, now()),
        attempts = attempts + 1,
        updated_at = now()
      WHERE id = $1 AND status = 'pending'
      RETURNING
        id,
        branch_code,
        order_code,
        txlogistic_id,
        jt_send_enabled,
        force_send,
        reason
    `,
    [requestId],
  );

  return result.rows[0] ?? null;
}

async function finishRequest(
  db: ReturnType<typeof createPostgresDatabase>,
  requestId: string,
  status: "succeeded" | "failed",
  lastError?: string,
): Promise<void> {
  await db.query(
    `
      UPDATE reprocess_requests
      SET
        status = $2,
        last_error = $3,
        finished_at = now(),
        updated_at = now()
      WHERE id = $1
    `,
    [requestId, status, lastError],
  );
}

async function loadStoredOrder(
  db: ReturnType<typeof createPostgresDatabase>,
  branchCode: number,
  orderCode: number,
): Promise<SalesOrder> {
  const result = await db.query<StoredOrderRow>(
    `
      SELECT raw_order
      FROM orders
      WHERE branch_code = $1 AND order_code = $2
      LIMIT 1
    `,
    [branchCode, orderCode],
  );

  const row = result.rows[0];
  if (!row) {
    throw new IntegrationError("Pedido nao encontrado na tabela orders.", {
      branchCode,
      orderCode,
    });
  }

  return row.raw_order;
}

async function loadActiveOverride(
  db: ReturnType<typeof createPostgresDatabase>,
  branchCode: number,
  orderCode: number,
): Promise<OrderOverrideRow | undefined> {
  const result = await db.query<OrderOverrideRow>(
    `
      SELECT id, patch
      FROM order_overrides
      WHERE branch_code = $1
        AND order_code = $2
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [branchCode, orderCode],
  );

  return result.rows[0];
}

async function saveAttempt(
  db: ReturnType<typeof createPostgresDatabase>,
  input: {
    request: ReprocessRequestRow;
    txlogisticId: string;
    status: ReprocessAttemptStatus;
    payload?: PickupRequestPayload;
    response?: unknown;
    errorMessage?: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await db.query(
    `
      INSERT INTO reprocess_attempts (
        id,
        request_id,
        branch_code,
        order_code,
        txlogistic_id,
        status,
        jt_send_enabled,
        force_send,
        payload,
        response,
        error_message,
        details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `,
    [
      randomUUID(),
      input.request.id,
      input.request.branch_code,
      Number(input.request.order_code),
      input.txlogisticId,
      input.status,
      input.request.jt_send_enabled,
      input.request.force_send,
      input.payload ? toJsonb(sanitizeForLogging(input.payload)) : undefined,
      input.response ? toJsonb(sanitizeForLogging(input.response)) : undefined,
      input.errorMessage,
      toJsonb(sanitizeForLogging(input.details ?? {})),
    ],
  );
}

async function main(): Promise<void> {
  const settings = loadSettings();
  if (!settings.postgres) {
    throw new IntegrationError("Reprocessamento exige PERSISTENCE_ADAPTER=postgres.");
  }

  const limit = parsePositiveInteger(
    getArgValue(process.argv.slice(2), "limit") ?? process.env.REPROCESS_LIMIT,
    5,
  );
  const db = createPostgresDatabase(settings.postgres);
  const httpClient = new FetchHttpClient();
  const pickupRequestsRepository = new PostgresPickupRequestsRepository(db);
  const operationalIssuesRepository = new PostgresOperationalIssuesRepository(db);
  const orderProcessingEventsRepository =
    new PostgresOrderProcessingEventsRepository(db);
  const idempotencyService = new IdempotencyService(pickupRequestsRepository);
  const eligibilityService = new EligibilityService();
  const orderNormalizer = new OrderNormalizer();
  const pickupPayloadBuilder = new PickupPayloadBuilder(settings.jt);
  const pickupValidator = new PickupValidator();
  const jtClient = new JtClient(
    settings.jt,
    httpClient,
    new JtSignatureService(settings.jt),
  );

  try {
    const pendingRequests = await loadPendingRequests(db, limit);

    if (pendingRequests.length === 0) {
      console.log(JSON.stringify({ processed: 0, message: "Fila vazia." }, null, 2));
      return;
    }

    const processed: Array<Record<string, unknown>> = [];

    for (const pending of pendingRequests) {
      const request = await markRunning(db, pending.id);
      if (!request) {
        continue;
      }

      const orderCode = Number(request.order_code);

      try {
        const storedOrder = await loadStoredOrder(db, request.branch_code, orderCode);
        const override = await loadActiveOverride(db, request.branch_code, orderCode);
        const order = applyOverride(storedOrder, override);
        const txlogisticId = buildTxlogisticId(request, order);
        const eligibility = eligibilityService.evaluate(order);

        if (!eligibility.eligible) {
          throw new IntegrationError("Pedido inelegivel para reprocessamento.", {
            branchCode: request.branch_code,
            orderCode,
            txlogisticId,
            reasons: eligibility.reasons,
          });
        }

        await operationalIssuesRepository.resolveByOrder(
          request.branch_code,
          orderCode,
          "Pedido reprocessado com validacao de elegibilidade.",
        );

        const normalizedOrder = orderNormalizer.normalize(order);
        const payload = pickupPayloadBuilder.build({
          txlogisticId,
          normalizedOrder,
          bizDigest: jtClient.createBusinessDigest(),
        });

        pickupValidator.validate(payload);

        if (
          !request.force_send &&
          (await idempotencyService.shouldCreatePickup(order)) === false
        ) {
          await saveAttempt(db, {
            request,
            txlogisticId,
            status: "already-created",
            payload,
            details: {
              overrideId: override?.id,
              reason: "pickup-already-created",
            },
          });
          await orderProcessingEventsRepository.record({
            eventType: "reprocess",
            branchCode: request.branch_code,
            orderCode,
            txlogisticId,
            status: "already-created",
            reason: request.reason,
          });
          await finishRequest(db, request.id, "succeeded");
          processed.push({ id: request.id, status: "already-created" });
          continue;
        }

        if (!request.jt_send_enabled) {
          await saveAttempt(db, {
            request,
            txlogisticId,
            status: "dry-run",
            payload,
            details: {
              overrideId: override?.id,
              itemQuantity: normalizedOrder.totalQuantity,
              packageQuantity: payload.totalQuantity,
              weight: normalizedOrder.totalWeightKg,
            },
          });
          await orderProcessingEventsRepository.record({
            eventType: "reprocess",
            branchCode: request.branch_code,
            orderCode,
            txlogisticId,
            status: "dry-run",
            reason: request.reason,
          });
          await finishRequest(db, request.id, "succeeded");
          processed.push({ id: request.id, status: "dry-run" });
          continue;
        }

        const pickupReserved = await pickupRequestsRepository.reserve(txlogisticId);
        if (!pickupReserved) {
          await saveAttempt(db, {
            request,
            txlogisticId,
            status: "already-created",
            payload,
            details: {
              overrideId: override?.id,
              reason: "pickup-already-reserved-or-created",
            },
          });
          await orderProcessingEventsRepository.record({
            eventType: "reprocess",
            branchCode: request.branch_code,
            orderCode,
            txlogisticId,
            status: "already-created",
            reason: request.reason,
          });
          await finishRequest(db, request.id, "succeeded");
          processed.push({ id: request.id, status: "already-created" });
          continue;
        }

        let createdPickup: CreatedPickup;
        try {
          createdPickup = await jtClient.addOrder(payload);
          await pickupRequestsRepository.save(createdPickup);
        } catch (error) {
          await pickupRequestsRepository.markFailed(
            txlogisticId,
            error instanceof Error ? error.message : "Falha ao enviar pedido para J&T.",
          );
          throw error;
        }

        await saveAttempt(db, {
          request,
          txlogisticId,
          status: "succeeded",
          payload,
          response: createdPickup.rawResponse,
          details: {
            billCode: createdPickup.billCode,
            overrideId: override?.id,
          },
        });
        await orderProcessingEventsRepository.record({
          eventType: "reprocess",
          branchCode: request.branch_code,
          orderCode,
          txlogisticId: createdPickup.txlogisticId,
          status: "succeeded",
          reason: request.reason,
          details: {
            billCode: createdPickup.billCode,
          },
        });
        await finishRequest(db, request.id, "succeeded");
        processed.push({
          id: request.id,
          status: "succeeded",
          txlogisticId: createdPickup.txlogisticId,
          billCode: createdPickup.billCode,
        });
      } catch (error) {
        const handledError =
          error instanceof IntegrationError
            ? error
            : new IntegrationError("Falha ao reprocessar pedido.", { error });
        const txlogisticId =
          request.txlogistic_id ?? `${request.branch_code}-${orderCode}`;

        await saveAttempt(db, {
          request,
          txlogisticId,
          status: "failed",
          errorMessage: handledError.message,
          details: handledError.context,
        });
        await operationalIssuesRepository.upsertOpen({
          issueKey: `${request.branch_code}:${orderCode}:reprocess:${handledError.message}`,
          branchCode: request.branch_code,
          orderCode,
          txlogisticId,
          issueType: "reprocess",
          severity: "high",
          reason: handledError.message,
          details: handledError.context,
        });
        await orderProcessingEventsRepository.record({
          eventType: "reprocess",
          branchCode: request.branch_code,
          orderCode,
          txlogisticId,
          status: "failed",
          reason: handledError.message,
          details: handledError.context,
        });
        await finishRequest(db, request.id, "failed", handledError.message);
        processed.push({
          id: request.id,
          status: "failed",
          error: handledError.message,
        });
      }
    }

    console.log(JSON.stringify({ processed: processed.length, items: processed }, null, 2));
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
