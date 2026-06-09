import type { SalesOrder } from "../../../domain/models/order.js";

export interface OrdersRepository {
  upsert(order: SalesOrder): Promise<void>;
}
