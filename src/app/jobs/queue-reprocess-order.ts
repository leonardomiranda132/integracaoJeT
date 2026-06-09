import { randomUUID } from "node:crypto";
import { loadPostgresSettings } from "../../config/settings.js";
import { createPostgresDatabase } from "../../infrastructure/persistence/postgres/postgres-database.js";

interface QueueOptions {
  branchCode: number;
  orderCode: number;
  reason: string;
  requestedBy: string;
  jtSendEnabled: boolean;
  forceSend: boolean;
}

async function assertOrderCanBeReprocessed(
  db: ReturnType<typeof createPostgresDatabase>,
  branchCode: number,
  orderCode: number,
): Promise<void> {
  const result = await db.query<{ total: string }>(
    `
      SELECT count(*) AS total
      FROM operational_issues
      WHERE branch_code = $1
        AND order_code = $2
        AND status = 'open'
    `,
    [branchCode, orderCode],
  );

  if (Number(result.rows[0]?.total ?? 0) === 0) {
    throw new Error(
      "Reprocessamento so e liberado para pedido com pendencia operacional aberta.",
    );
  }
}

function getArgValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseRequiredNumber(
  value: string | undefined,
  envName: string,
  label: string,
): number {
  const parsed = Number(value ?? process.env[envName]);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Informe ${label} com --${label}=N ou ${envName}=N.`);
  }

  return parsed;
}

function parseOptions(argv: string[]): QueueOptions {
  return {
    branchCode: parseRequiredNumber(
      getArgValue(argv, "branch"),
      "ORDER_BRANCH_CODE",
      "branch",
    ),
    orderCode: parseRequiredNumber(
      getArgValue(argv, "order"),
      "ORDER_CODE",
      "order",
    ),
    reason:
      getArgValue(argv, "reason") ??
      process.env.REPROCESS_REASON ??
      "Reprocessamento solicitado manualmente.",
    requestedBy:
      getArgValue(argv, "requested-by") ??
      process.env.REPROCESS_REQUESTED_BY ??
      "operator",
    jtSendEnabled:
      hasFlag(argv, "send") ||
      parseBoolean(process.env.REPROCESS_JT_SEND_ENABLED, false),
    forceSend:
      hasFlag(argv, "force-send") ||
      parseBoolean(process.env.REPROCESS_FORCE_SEND, false),
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const db = createPostgresDatabase(loadPostgresSettings());
  const id = randomUUID();
  const txlogisticId = `${options.branchCode}-${options.orderCode}`;

  try {
    await assertOrderCanBeReprocessed(db, options.branchCode, options.orderCode);

    try {
      await db.query(
        `
          INSERT INTO reprocess_requests (
            id,
            branch_code,
            order_code,
            txlogistic_id,
            requested_by,
            reason,
            jt_send_enabled,
            force_send
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          id,
          options.branchCode,
          options.orderCode,
          txlogisticId,
          options.requestedBy,
          options.reason,
          options.jtSendEnabled,
          options.forceSend,
        ],
      );
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new Error(
          "Ja existe um reprocessamento pendente ou em andamento para este pedido.",
        );
      }

      throw error;
    }

    console.log(
      JSON.stringify(
        {
          id,
          branchCode: options.branchCode,
          orderCode: options.orderCode,
          txlogisticId,
          status: "pending",
          jtSendEnabled: options.jtSendEnabled,
          forceSend: options.forceSend,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
