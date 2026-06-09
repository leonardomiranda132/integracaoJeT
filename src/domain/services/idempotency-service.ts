import type { PickupRequestsRepository } from "../../infrastructure/persistence/repositories/pickup-requests-repository.js";
import type { SalesOrder } from "../models/order.js";

export class IdempotencyService {
  constructor(private readonly pickupRequestsRepository: PickupRequestsRepository) {}

  buildTxlogisticId(order: SalesOrder): string {
    return `${order.branchCode}-${order.orderCode}`;
  }

  async shouldCreatePickup(order: SalesOrder): Promise<boolean> {
    const txlogisticId = this.buildTxlogisticId(order);
    return !(await this.pickupRequestsRepository.existsByTxlogisticId(txlogisticId));
  }
}
