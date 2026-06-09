import type { TotvsClient } from "../../infrastructure/http/totvs-client.js";
import type { PersonClient } from "../../infrastructure/http/person-client.js";
import type { Logger } from "../../infrastructure/logging/logger.js";
import {
  loadOperationalSettings,
  type OperationalSettings,
} from "../../config/settings.js";
import type { IntegrationErrorsRepository } from "../../infrastructure/persistence/repositories/integration-errors-repository.js";
import type { ExecutionLockRepository } from "../../infrastructure/persistence/repositories/execution-lock-repository.js";
import type {
  OperationalIssuesRepository,
  OperationalIssueSeverity,
} from "../../infrastructure/persistence/repositories/operational-issues-repository.js";
import type { OrderProcessingEventsRepository } from "../../infrastructure/persistence/repositories/order-processing-events-repository.js";
import type { OrdersRepository } from "../../infrastructure/persistence/repositories/orders-repository.js";
import type { SyncRunsRepository } from "../../infrastructure/persistence/repositories/sync-runs-repository.js";
import type { TimeWindow } from "../../shared/types.js";
import { IntegrationError } from "../../domain/errors/integration-error.js";
import type { CustomerPhone, SalesOrder } from "../../domain/models/order.js";
import type { CreatedPickup } from "../../domain/models/pickup.js";
import type { SyncRun } from "../../domain/models/sync-run.js";
import { EligibilityService } from "../../domain/services/eligibility-service.js";
import { IdempotencyService } from "../../domain/services/idempotency-service.js";
import { OrderNormalizer } from "../../domain/services/order-normalizer.js";
import { PickupPayloadBuilder } from "../../domain/services/pickup-payload-builder.js";
import { PickupValidator } from "../../domain/validators/pickup-validator.js";
import type { JtClient } from "../../infrastructure/http/jt-client.js";
import type { PickupRequestsRepository } from "../../infrastructure/persistence/repositories/pickup-requests-repository.js";

export interface SyncOrdersDependencies {
  totvsClient: TotvsClient;
  personClient: PersonClient;
  jtClient: JtClient;
  executionLockRepository: ExecutionLockRepository;
  syncRunsRepository: SyncRunsRepository;
  ordersRepository: OrdersRepository;
  pickupRequestsRepository: PickupRequestsRepository;
  integrationErrorsRepository: IntegrationErrorsRepository;
  operationalIssuesRepository: OperationalIssuesRepository;
  orderProcessingEventsRepository: OrderProcessingEventsRepository;
  logger: Logger;
  eligibilityService: EligibilityService;
  idempotencyService: IdempotencyService;
  orderNormalizer: OrderNormalizer;
  pickupPayloadBuilder: PickupPayloadBuilder;
  pickupValidator: PickupValidator;
  operationalSettings?: OperationalSettings;
}

export class SyncOrdersUseCase {
  private readonly operationalSettings: OperationalSettings;

  constructor(private readonly dependencies: SyncOrdersDependencies) {
    this.operationalSettings =
      dependencies.operationalSettings ?? loadOperationalSettings();
  }

  private buildExecutionLockKey(window: TimeWindow): string {
    return `sync-orders:${window.startDate}:${window.endDate}`;
  }

  private incrementCounter(counter: Map<string, number>, key: string): void {
    counter.set(key, (counter.get(key) ?? 0) + 1);
  }

  private buildCounterSummary(counter: Map<string, number>): Array<{
    reason: string;
    count: number;
  }> {
    return Array.from(counter, ([reason, count]) => ({ reason, count }));
  }

  private buildOperationalIssueKey(
    order: SalesOrder,
    issueType: string,
    reason: string,
  ): string {
    return `${order.branchCode}:${order.orderCode}:${issueType}:${reason}`;
  }

  private pickIssueSeverity(reason: string): OperationalIssueSeverity {
    if (reason === "missing-invoice" || reason === "missing-items") {
      return "high";
    }

    if (reason === "canceled") {
      return "low";
    }

    return "medium";
  }

  private pickPhoneByType(
    phones: CustomerPhone[],
    typeName: string,
  ): string | undefined {
    return phones.find((phone) => phone.typeName?.toUpperCase() === typeName)?.number;
  }

  private pickDefaultPhone(phones: CustomerPhone[]): string | undefined {
    return phones.find((phone) => phone.isDefault)?.number ?? phones[0]?.number;
  }

  private async enrichOrderWithCustomerPhone(order: SalesOrder): Promise<SalesOrder> {
    if (order.customerPhone || order.customerMobile || !order.customerCode) {
      return order;
    }

    const phones = await this.dependencies.personClient.searchPhonesByCustomerCode(
      order.customerCode,
    );

    if (phones.length === 0) {
      return order;
    }

    return {
      ...order,
      phones,
      customerMobile:
        this.pickPhoneByType(phones, "CELULAR") ??
        this.pickPhoneByType(phones, "MOBILE") ??
        this.pickPhoneByType(phones, "FIXO") ??
        this.pickDefaultPhone(phones),
      customerPhone:
        this.pickPhoneByType(phones, "FIXO") ?? this.pickDefaultPhone(phones),
    };
  }

  async execute(window: TimeWindow): Promise<void> {
    const {
      totvsClient,
      jtClient,
      executionLockRepository,
      syncRunsRepository,
      ordersRepository,
      pickupRequestsRepository,
      integrationErrorsRepository,
      operationalIssuesRepository,
      orderProcessingEventsRepository,
      logger,
      eligibilityService,
      idempotencyService,
      orderNormalizer,
      pickupPayloadBuilder,
      pickupValidator,
    } = this.dependencies;

    const lockKey = this.buildExecutionLockKey(window);
    const lockAcquired = await executionLockRepository.acquire(lockKey);

    if (!lockAcquired) {
      throw new IntegrationError("Execucao do lote ja em andamento.", {
        lockKey,
        window,
      });
    }

    let syncRun: SyncRun | undefined;
    let pagesRead = 0;
    let ordersRead = 0;
    let ordersIgnored = 0;
    let pickupsDryRun = 0;
    let pickupsCreated = 0;
    let pickupsSent = 0;
    let errors = 0;
    let sendLimitReached = false;
    let ordersNotProcessedAfterLimit = 0;
    const ineligibilityReasonsCount = new Map<string, number>();
    const { jtSendEnabled, dailySendLimit } = this.operationalSettings;

    try {
      syncRun = await syncRunsRepository.start(window);

      const searchResult = await totvsClient.searchOrdersWithMetadata(window, {
        onPageRead: (page) => {
          pagesRead = page;
        },
      });
      const orders = searchResult.orders;
      pagesRead = searchResult.pagesRead;
      ordersRead = orders.length;

      logger.info("Pedidos TOTVS lidos.", {
        pagesRead,
        ordersRead,
      });

      for (let orderIndex = 0; orderIndex < orders.length; orderIndex += 1) {
        if (
          jtSendEnabled &&
          dailySendLimit !== undefined &&
          pickupsSent >= dailySendLimit
        ) {
          sendLimitReached = true;
          ordersNotProcessedAfterLimit = orders.length - orderIndex;
          logger.info("Limite diario de envio atingido.", {
            dailySendLimit,
            pickupsSent,
            ordersNotProcessedAfterLimit,
          });
          break;
        }

        const rawOrder = orders[orderIndex];
        const order = await this.enrichOrderWithCustomerPhone(rawOrder);
        const txlogisticId = idempotencyService.buildTxlogisticId(order);
        await ordersRepository.upsert(order);

        try {
          const eligibility = eligibilityService.evaluate(order);

          if (!eligibility.eligible) {
            ordersIgnored += 1;
            for (const reason of eligibility.reasons) {
              this.incrementCounter(ineligibilityReasonsCount, reason);
            }

            logger.info("Pedido ignorado por elegibilidade.", {
              orderCode: order.orderCode,
              branchCode: order.branchCode,
              reasons: eligibility.reasons,
            });

            await orderProcessingEventsRepository.record({
              syncRunId: syncRun.id,
              eventType: "eligibility",
              branchCode: order.branchCode,
              orderCode: order.orderCode,
              txlogisticId,
              status: "ignored",
              reason: eligibility.reasons.join(","),
              details: {
                reasons: eligibility.reasons,
                statusOrder: order.statusOrder,
              },
            });

            for (const reason of eligibility.reasons) {
              await operationalIssuesRepository.upsertOpen({
                issueKey: this.buildOperationalIssueKey(
                  order,
                  "eligibility",
                  reason,
                ),
                branchCode: order.branchCode,
                orderCode: order.orderCode,
                txlogisticId,
                issueType: "eligibility",
                severity: this.pickIssueSeverity(reason),
                reason,
                details: {
                  reasons: eligibility.reasons,
                  statusOrder: order.statusOrder,
                  syncRunId: syncRun.id,
                },
              });
            }
            continue;
          }

          await operationalIssuesRepository.resolveByOrder(
            order.branchCode,
            order.orderCode,
            "Pedido voltou a ficar elegivel no sync.",
          );

          if (!(await idempotencyService.shouldCreatePickup(order))) {
            ordersIgnored += 1;
            logger.info("Pedido ignorado por idempotencia.", {
              orderCode: order.orderCode,
              branchCode: order.branchCode,
            });
            await orderProcessingEventsRepository.record({
              syncRunId: syncRun.id,
              eventType: "idempotency",
              branchCode: order.branchCode,
              orderCode: order.orderCode,
              txlogisticId,
              status: "ignored",
              reason: "pickup-already-created",
            });
            continue;
          }

          const normalizedOrder = orderNormalizer.normalize(order);
          const payload = pickupPayloadBuilder.build({
            txlogisticId,
            normalizedOrder,
            bizDigest: jtClient.createBusinessDigest(),
          });

          pickupValidator.validate(payload);

          if (!jtSendEnabled) {
            pickupsDryRun += 1;
            logger.info("Dry-run de coleta validado sem envio para J&T.", {
              orderCode: order.orderCode,
              branchCode: order.branchCode,
              txlogisticId,
            });
            await orderProcessingEventsRepository.record({
              syncRunId: syncRun.id,
              eventType: "pickup-dry-run",
              branchCode: order.branchCode,
              orderCode: order.orderCode,
              txlogisticId,
              status: "validated",
              details: {
                itemQuantity: normalizedOrder.totalQuantity,
                packageQuantity: payload.totalQuantity,
                weight: normalizedOrder.totalWeightKg,
              },
            });
            continue;
          }

          const pickupReserved =
            await pickupRequestsRepository.reserve(txlogisticId);

          if (!pickupReserved) {
            ordersIgnored += 1;
            logger.info("Pedido ignorado por reserva de idempotencia.", {
              orderCode: order.orderCode,
              branchCode: order.branchCode,
              txlogisticId,
            });
            await orderProcessingEventsRepository.record({
              syncRunId: syncRun.id,
              eventType: "idempotency",
              branchCode: order.branchCode,
              orderCode: order.orderCode,
              txlogisticId,
              status: "ignored",
              reason: "pickup-already-reserved-or-created",
            });
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

          pickupsCreated += 1;
          pickupsSent += 1;

          logger.info("Coleta criada com sucesso.", {
            txlogisticId: createdPickup.txlogisticId,
            billCode: createdPickup.billCode,
          });
          await orderProcessingEventsRepository.record({
            syncRunId: syncRun.id,
            eventType: "pickup-created",
            branchCode: order.branchCode,
            orderCode: order.orderCode,
            txlogisticId: createdPickup.txlogisticId,
            status: "succeeded",
            details: {
              billCode: createdPickup.billCode,
            },
          });
        } catch (error) {
          errors += 1;
          const handledError =
            error instanceof IntegrationError
              ? error
              : new IntegrationError("Erro inesperado ao processar pedido.", {
                  error,
                });

          await integrationErrorsRepository.save({
            source: "order-processing",
            message: handledError.message,
            context: {
              ...handledError.context,
              branchCode: order.branchCode,
              orderCode: order.orderCode,
              txlogisticId,
            },
          });

          await operationalIssuesRepository.upsertOpen({
            issueKey: this.buildOperationalIssueKey(
              order,
              "processing-error",
              handledError.message,
            ),
            branchCode: order.branchCode,
            orderCode: order.orderCode,
            txlogisticId,
            issueType: "processing-error",
            severity: "high",
            reason: handledError.message,
            details: {
              context: handledError.context,
              syncRunId: syncRun.id,
            },
          });

          await orderProcessingEventsRepository.record({
            syncRunId: syncRun.id,
            eventType: "processing-error",
            branchCode: order.branchCode,
            orderCode: order.orderCode,
            txlogisticId,
            status: "failed",
            reason: handledError.message,
            details: handledError.context,
          });

          logger.error("Falha ao processar pedido.", {
            orderCode: order.orderCode,
            branchCode: order.branchCode,
            error: handledError.message,
          });
        }
      }

      logger.info("Resumo do sync de pedidos.", {
        pagesRead,
        ordersRead,
        ordersIgnored,
        pickupsDryRun,
        pickupsSent,
        pickupsCreated,
        errors,
        jtSendEnabled,
        dailySendLimit,
        sendLimitReached,
        ordersNotProcessedAfterLimit,
        ineligibilityReasons: this.buildCounterSummary(ineligibilityReasonsCount),
      });

      await syncRunsRepository.finish(syncRun.id, {
        status: "succeeded",
        pagesRead,
        ordersRead,
        pickupsCreated,
        errors,
      });
    } catch (error) {
      const handledError =
        error instanceof IntegrationError
          ? error
          : new IntegrationError("Falha geral na execucao do sync.", { error });

      await integrationErrorsRepository.save({
        source: "sync-run",
        message: handledError.message,
        context: handledError.context,
      });

      if (syncRun) {
        logger.error("Resumo do sync de pedidos com falha.", {
          pagesRead,
          ordersRead,
          ordersIgnored,
          pickupsDryRun,
          pickupsSent,
          pickupsCreated,
          errors: errors + 1,
          jtSendEnabled,
          dailySendLimit,
          sendLimitReached,
          ordersNotProcessedAfterLimit,
          ineligibilityReasons: this.buildCounterSummary(ineligibilityReasonsCount),
        });

        await syncRunsRepository.finish(syncRun.id, {
          status: "failed",
          pagesRead,
          ordersRead,
          pickupsCreated,
          errors: errors + 1,
        });
      }

      throw handledError;
    } finally {
      await executionLockRepository.release(lockKey);
    }
  }
}
