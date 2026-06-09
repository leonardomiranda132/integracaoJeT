import type { SalesOrder } from "../../../domain/models/order.js";
import type { CreatedPickup } from "../../../domain/models/pickup.js";
import type { SyncRun } from "../../../domain/models/sync-run.js";
import type { OperationalIssueInput } from "../repositories/operational-issues-repository.js";
import type { OrderProcessingEventInput } from "../repositories/order-processing-events-repository.js";

export interface MemoryDatabase {
  syncRuns: SyncRun[];
  orders: SalesOrder[];
  pickups: CreatedPickup[];
  errors: Array<{
    source: string;
    message: string;
    context?: Record<string, unknown>;
  }>;
  operationalIssues: Array<
    OperationalIssueInput & {
      status: "open" | "resolved";
      firstSeenAt: string;
      lastSeenAt: string;
      resolutionNote?: string;
    }
  >;
  orderProcessingEvents: Array<
    OrderProcessingEventInput & {
      eventTime: string;
    }
  >;
}

export function createMemoryDatabase(): MemoryDatabase {
  return {
    syncRuns: [],
    orders: [],
    pickups: [],
    errors: [],
    operationalIssues: [],
    orderProcessingEvents: [],
  };
}
