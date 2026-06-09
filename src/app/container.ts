import { loadSettings, type AppSettings } from "../config/settings.js";
import { SyncOrdersUseCase } from "../application/use-cases/sync-orders.js";
import { EligibilityService } from "../domain/services/eligibility-service.js";
import { IdempotencyService } from "../domain/services/idempotency-service.js";
import { OrderNormalizer } from "../domain/services/order-normalizer.js";
import { PickupPayloadBuilder } from "../domain/services/pickup-payload-builder.js";
import { PickupValidator } from "../domain/validators/pickup-validator.js";
import { FetchHttpClient } from "../infrastructure/http/fetch-http-client.js";
import { JtClient } from "../infrastructure/http/jt-client.js";
import { PersonClient } from "../infrastructure/http/person-client.js";
import { JtSignatureService } from "../infrastructure/http/jt-signature-service.js";
import { TotvsClient } from "../infrastructure/http/totvs-client.js";
import { ConsoleLogger } from "../infrastructure/logging/logger.js";
import { createMemoryDatabase } from "../infrastructure/persistence/memory/memory-database.js";
import { MemoryIntegrationErrorsRepository } from "../infrastructure/persistence/memory/memory-integration-errors-repository.js";
import { MemoryExecutionLockRepository } from "../infrastructure/persistence/memory/memory-execution-lock-repository.js";
import { MemoryOperationalIssuesRepository } from "../infrastructure/persistence/memory/memory-operational-issues-repository.js";
import { MemoryOrderProcessingEventsRepository } from "../infrastructure/persistence/memory/memory-order-processing-events-repository.js";
import { MemoryOrdersRepository } from "../infrastructure/persistence/memory/memory-orders-repository.js";
import { MemoryPickupRequestsRepository } from "../infrastructure/persistence/memory/memory-pickup-requests-repository.js";
import { MemorySyncRunsRepository } from "../infrastructure/persistence/memory/memory-sync-runs-repository.js";
import { createPostgresDatabase } from "../infrastructure/persistence/postgres/postgres-database.js";
import { PostgresExecutionLockRepository } from "../infrastructure/persistence/postgres/postgres-execution-lock-repository.js";
import { PostgresIntegrationErrorsRepository } from "../infrastructure/persistence/postgres/postgres-integration-errors-repository.js";
import { PostgresOperationalIssuesRepository } from "../infrastructure/persistence/postgres/postgres-operational-issues-repository.js";
import { PostgresOrderProcessingEventsRepository } from "../infrastructure/persistence/postgres/postgres-order-processing-events-repository.js";
import { PostgresOrdersRepository } from "../infrastructure/persistence/postgres/postgres-orders-repository.js";
import { PostgresPickupRequestsRepository } from "../infrastructure/persistence/postgres/postgres-pickup-requests-repository.js";
import { PostgresSyncRunsRepository } from "../infrastructure/persistence/postgres/postgres-sync-runs-repository.js";
import type { ExecutionLockRepository } from "../infrastructure/persistence/repositories/execution-lock-repository.js";
import type { IntegrationErrorsRepository } from "../infrastructure/persistence/repositories/integration-errors-repository.js";
import type { OperationalIssuesRepository } from "../infrastructure/persistence/repositories/operational-issues-repository.js";
import type { OrderProcessingEventsRepository } from "../infrastructure/persistence/repositories/order-processing-events-repository.js";
import type { OrdersRepository } from "../infrastructure/persistence/repositories/orders-repository.js";
import type { PickupRequestsRepository } from "../infrastructure/persistence/repositories/pickup-requests-repository.js";
import type { SyncRunsRepository } from "../infrastructure/persistence/repositories/sync-runs-repository.js";

interface PersistenceRepositories {
  executionLockRepository: ExecutionLockRepository;
  syncRunsRepository: SyncRunsRepository;
  ordersRepository: OrdersRepository;
  pickupRequestsRepository: PickupRequestsRepository;
  integrationErrorsRepository: IntegrationErrorsRepository;
  operationalIssuesRepository: OperationalIssuesRepository;
  orderProcessingEventsRepository: OrderProcessingEventsRepository;
}

function createPersistenceRepositories(settings: AppSettings): PersistenceRepositories {
  if (settings.persistenceAdapter === "postgres") {
    const postgresSettings = settings.postgres;

    if (!postgresSettings) {
      throw new Error("Configuracao Postgres ausente.");
    }

    const db = createPostgresDatabase(postgresSettings);

    return {
      executionLockRepository: new PostgresExecutionLockRepository(db),
      syncRunsRepository: new PostgresSyncRunsRepository(db),
      ordersRepository: new PostgresOrdersRepository(db),
      pickupRequestsRepository: new PostgresPickupRequestsRepository(db),
      integrationErrorsRepository: new PostgresIntegrationErrorsRepository(db),
      operationalIssuesRepository: new PostgresOperationalIssuesRepository(db),
      orderProcessingEventsRepository:
        new PostgresOrderProcessingEventsRepository(db),
    };
  }

  const db = createMemoryDatabase();

  return {
    executionLockRepository: new MemoryExecutionLockRepository(),
    syncRunsRepository: new MemorySyncRunsRepository(db),
    ordersRepository: new MemoryOrdersRepository(db),
    pickupRequestsRepository: new MemoryPickupRequestsRepository(db),
    integrationErrorsRepository: new MemoryIntegrationErrorsRepository(db),
    operationalIssuesRepository: new MemoryOperationalIssuesRepository(db),
    orderProcessingEventsRepository: new MemoryOrderProcessingEventsRepository(db),
  };
}

export function createContainer() {
  const settings = loadSettings();
  const logger = new ConsoleLogger();
  const httpClient = new FetchHttpClient();
  const {
    executionLockRepository,
    syncRunsRepository,
    ordersRepository,
    pickupRequestsRepository,
    integrationErrorsRepository,
    operationalIssuesRepository,
    orderProcessingEventsRepository,
  } = createPersistenceRepositories(settings);

  const eligibilityService = new EligibilityService();
  const idempotencyService = new IdempotencyService(pickupRequestsRepository);
  const orderNormalizer = new OrderNormalizer();
  const pickupPayloadBuilder = new PickupPayloadBuilder(settings.jt);
  const pickupValidator = new PickupValidator();

  const totvsClient = new TotvsClient(settings.totvs, httpClient);
  const personClient = new PersonClient(settings.totvs, httpClient);
  const jtClient = new JtClient(
    settings.jt,
    httpClient,
    new JtSignatureService(settings.jt),
  );

  const syncOrdersUseCase = new SyncOrdersUseCase({
    totvsClient,
    personClient,
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
    operationalSettings: settings.operational,
  });

  return {
    settings,
    logger,
    repositories: {
      executionLockRepository,
      syncRunsRepository,
      ordersRepository,
      pickupRequestsRepository,
      integrationErrorsRepository,
      operationalIssuesRepository,
      orderProcessingEventsRepository,
    },
    useCases: {
      syncOrdersUseCase,
    },
  };
}
