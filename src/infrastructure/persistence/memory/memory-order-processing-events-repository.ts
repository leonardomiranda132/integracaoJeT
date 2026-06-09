import type { MemoryDatabase } from "./memory-database.js";
import type {
  OrderProcessingEventInput,
  OrderProcessingEventsRepository,
} from "../repositories/order-processing-events-repository.js";

export class MemoryOrderProcessingEventsRepository
  implements OrderProcessingEventsRepository
{
  constructor(private readonly db: MemoryDatabase) {}

  async record(event: OrderProcessingEventInput): Promise<void> {
    this.db.orderProcessingEvents.push({
      ...event,
      eventTime: new Date().toISOString(),
    });
  }
}
