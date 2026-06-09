import { randomUUID } from "node:crypto";
import type { CreatedPickup } from "../../../domain/models/pickup.js";
import type { PickupRequestsRepository } from "../repositories/pickup-requests-repository.js";
import { toJsonb } from "./json.js";
import type { PostgresDatabase } from "./postgres-database.js";

function parseTxlogisticId(
  txlogisticId: string,
): { branchCode?: number; orderCode?: number } {
  const match = /^(\d+)-(\d+)$/.exec(txlogisticId);

  if (!match) {
    return {};
  }

  return {
    branchCode: Number(match[1]),
    orderCode: Number(match[2]),
  };
}

export class PostgresPickupRequestsRepository
  implements PickupRequestsRepository
{
  constructor(private readonly db: PostgresDatabase) {}

  async existsByTxlogisticId(txlogisticId: string): Promise<boolean> {
    const result = await this.db.query(
      "SELECT 1 FROM pickup_requests WHERE txlogistic_id = $1 LIMIT 1",
      [txlogisticId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async reserve(txlogisticId: string): Promise<boolean> {
    const parsedId = parseTxlogisticId(txlogisticId);
    const result = await this.db.query(
      `
        INSERT INTO pickup_requests (
          id,
          txlogistic_id,
          branch_code,
          order_code,
          bill_code,
          status,
          raw_response
        )
        VALUES ($1, $2, $3, $4, '', 'reserved', '{}'::jsonb)
        ON CONFLICT (txlogistic_id) DO NOTHING
      `,
      [randomUUID(), txlogisticId, parsedId.branchCode, parsedId.orderCode],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async save(createdPickup: CreatedPickup): Promise<void> {
    const parsedId = parseTxlogisticId(createdPickup.txlogisticId);

    await this.db.query(
      `
        INSERT INTO pickup_requests (
          id,
          txlogistic_id,
          branch_code,
          order_code,
          bill_code,
          status,
          raw_response
        )
        VALUES ($1, $2, $3, $4, $5, 'created', $6)
        ON CONFLICT (txlogistic_id)
        DO UPDATE SET
          bill_code = EXCLUDED.bill_code,
          status = EXCLUDED.status,
          raw_response = EXCLUDED.raw_response,
          updated_at = now()
      `,
      [
        randomUUID(),
        createdPickup.txlogisticId,
        parsedId.branchCode,
        parsedId.orderCode,
        createdPickup.billCode,
        toJsonb(createdPickup.rawResponse),
      ],
    );
  }

  async markFailed(txlogisticId: string, errorMessage: string): Promise<void> {
    await this.db.query(
      `
        UPDATE pickup_requests
        SET
          status = 'failed',
          raw_response = $2,
          updated_at = now()
        WHERE txlogistic_id = $1
          AND status = 'reserved'
      `,
      [
        txlogisticId,
        toJsonb({
          errorMessage,
          failedAt: new Date().toISOString(),
        }),
      ],
    );
  }
}
