import type { CreatedPickup } from "../../../domain/models/pickup.js";

export interface PickupRequestsRepository {
  existsByTxlogisticId(txlogisticId: string): Promise<boolean>;
  reserve(txlogisticId: string): Promise<boolean>;
  save(createdPickup: CreatedPickup): Promise<void>;
  markFailed(txlogisticId: string, errorMessage: string): Promise<void>;
}
