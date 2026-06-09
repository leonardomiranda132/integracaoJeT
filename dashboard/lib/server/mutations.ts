import { randomUUID } from "node:crypto";
import { query, withClient } from "./db";

async function assertOrderCanBeReprocessed(
  branchCode: number,
  orderCode: number,
): Promise<void> {
  const rows = await query<{ total: string }>(
    `
      SELECT count(*) AS total
      FROM operational_issues
      WHERE branch_code = $1
        AND order_code = $2
        AND status = 'open'
    `,
    [branchCode, orderCode],
  );

  if (Number(rows[0]?.total ?? 0) === 0) {
    throw new Error(
      "Reprocessamento so e liberado para pedido com pendencia operacional aberta.",
    );
  }
}

export async function resolveIssue(id: string, resolutionNote: string): Promise<void> {
  await query(
    `
      UPDATE operational_issues
      SET
        status = 'resolved',
        resolved_at = now(),
        resolution_note = $2,
        updated_at = now()
      WHERE id = $1
    `,
    [id, resolutionNote],
  );
}

export async function createReprocessRequest(input: {
  branchCode: number;
  orderCode: number;
  reason: string;
  requestedBy: string;
  jtSendEnabled?: boolean;
  forceSend?: boolean;
}): Promise<{ id: string }> {
  const id = randomUUID();

  await assertOrderCanBeReprocessed(input.branchCode, input.orderCode);

  try {
    await query(
      `
        INSERT INTO reprocess_requests (
          id,
          branch_code,
          order_code,
          txlogistic_id,
          requested_by,
          reason,
          jt_send_enabled,
          force_send
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        id,
        input.branchCode,
        input.orderCode,
        `${input.branchCode}-${input.orderCode}`,
        input.requestedBy,
        input.reason,
        Boolean(input.jtSendEnabled),
        Boolean(input.forceSend),
      ],
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      throw new Error("Ja existe um reprocessamento pendente ou em andamento para este pedido.");
    }

    throw error;
  }

  return { id };
}

export async function createOrderOverride(input: {
  branchCode: number;
  orderCode: number;
  patch: Record<string, unknown>;
  reason: string;
  createdBy: string;
}): Promise<{ id: string }> {
  const id = randomUUID();

  await withClient(async (client) => {
    await client.query("BEGIN");

    try {
      await client.query(
        `
          UPDATE order_overrides
          SET
            status = 'disabled',
            disabled_at = now(),
            updated_at = now()
          WHERE branch_code = $1
            AND order_code = $2
            AND status = 'active'
        `,
        [input.branchCode, input.orderCode],
      );

      await client.query(
        `
          INSERT INTO order_overrides (
            id,
            branch_code,
            order_code,
            patch,
            reason,
            created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          id,
          input.branchCode,
          input.orderCode,
          JSON.stringify(input.patch),
          input.reason,
          input.createdBy,
        ],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  return { id };
}
