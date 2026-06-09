import { IntegrationError } from "../errors/integration-error.js";
import type { PickupRequestPayload } from "../models/pickup.js";

export class PickupValidator {
  validate(payload: PickupRequestPayload): void {
    const requiredValues = [
      payload.txlogisticId,
      payload.customerCode,
      payload.digest,
      payload.sender.name,
      payload.sender.postCode,
      payload.receiver.name,
      payload.receiver.postCode,
    ];

    if (requiredValues.some((value) => !value)) {
      throw new IntegrationError("Payload da J&T incompleto.", {
        txlogisticId: payload.txlogisticId,
      });
    }
  }
}
