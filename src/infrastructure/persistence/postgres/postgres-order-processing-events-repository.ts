import { sanitizeForLogging } from "../../logging/sanitizer.js";
import type {
  OrderProcessingEventInput,
  OrderProcessingEventsRepository,
} from "../repositories/order-processing-events-repository.js";
import { toJsonb } from "./json.js";
import type { PostgresDatabase } from "./postgres-database.js";

export class PostgresOrderProcessingEventsRepository
  implements OrderProcessingEventsRepository
{
  constructor(private readonly db: PostgresDatabase) {}

  async record(event: OrderProcessingEventInput): Promise<void> {
    await this.db.query(
      `
        INSERT INTO order_processing_events (
          sync_run_id,
          event_type,
          branch_code,
          order_code,
          txlogistic_id,
          status,
          reason,
          details
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        event.syncRunId,
        event.eventType,
        event.branchCode,
        event.orderCode,
        event.txlogisticId,
        event.status,
        event.reason,
        toJsonb(sanitizeForLogging(event.details ?? {})),
      ],
    );
  }
}
