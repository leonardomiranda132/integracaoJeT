import type { SalesOrder } from "../../../domain/models/order.js";
import type { MemoryDatabase } from "./memory-database.js";
import type { OrdersRepository } from "../repositories/orders-repository.js";

export class MemoryOrdersRepository implements OrdersRepository {
  constructor(private readonly db: MemoryDatabase) {}

  async upsert(order: SalesOrder): Promise<void> {
    const index = this.db.orders.findIndex(
      (item) =>
        item.branchCode === order.branchCode && item.orderCode === order.orderCode,
    );

    if (index >= 0) {
      this.db.orders[index] = order;
      return;
    }

    this.db.orders.push(order);
  }
}
