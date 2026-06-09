import type { CreatedPickup } from "../../../domain/models/pickup.js";
import type { MemoryDatabase } from "./memory-database.js";
import type { PickupRequestsRepository } from "../repositories/pickup-requests-repository.js";

export class MemoryPickupRequestsRepository implements PickupRequestsRepository {
  constructor(private readonly db: MemoryDatabase) {}

  async existsByTxlogisticId(txlogisticId: string): Promise<boolean> {
    return this.db.pickups.some((item) => item.txlogisticId === txlogisticId);
  }

  async reserve(txlogisticId: string): Promise<boolean> {
    if (await this.existsByTxlogisticId(txlogisticId)) {
      return false;
    }

    this.db.pickups.push({
      txlogisticId,
      billCode: "",
      rawResponse: { status: "reserved" },
    });
    return true;
  }

  async save(createdPickup: CreatedPickup): Promise<void> {
    const index = this.db.pickups.findIndex(
      (item) => item.txlogisticId === createdPickup.txlogisticId,
    );

    if (index >= 0) {
      this.db.pickups[index] = createdPickup;
      return;
    }

    this.db.pickups.push(createdPickup);
  }

  async markFailed(txlogisticId: string, errorMessage: string): Promise<void> {
    const item = this.db.pickups.find(
      (current) => current.txlogisticId === txlogisticId,
    );

    if (item) {
      item.rawResponse = { status: "failed", errorMessage };
    }
  }
}
