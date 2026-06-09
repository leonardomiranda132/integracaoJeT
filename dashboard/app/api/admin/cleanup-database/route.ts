import { NextRequest, NextResponse } from "next/server";
import { assertConfirmation, assertOperationsToken } from "../../../../lib/server/admin-actions";
import { getDatabaseConnectionInfo, withClient } from "../../../../lib/server/db";

export const dynamic = "force-dynamic";

const OPERATIONAL_TABLES = [
  "reprocess_attempts",
  "reprocess_requests",
  "order_processing_events",
  "order_overrides",
  "operational_issues",
  "integration_errors",
  "pickup_requests",
  "orders",
  "sync_runs",
  "execution_locks",
];

type TableCount = Record<string, number>;

async function tableCounts(client: Parameters<Parameters<typeof withClient>[0]>[0]): Promise<TableCount> {
  const counts: TableCount = {};

  for (const table of OPERATIONAL_TABLES) {
    const result = await client.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM ${table}`,
    );
    counts[table] = result.rows[0]?.total ?? 0;
  }

  return counts;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      actionToken?: unknown;
      confirmation?: unknown;
    };

    assertOperationsToken(request, body.actionToken);
    assertConfirmation(body.confirmation, "LIMPAR BANCO");

    const database = getDatabaseConnectionInfo();
    if (database.kind !== "remote") {
      return NextResponse.json(
        {
          error: "A limpeza foi bloqueada porque o banco selecionado nao e remoto.",
          database,
        },
        { status: 409 },
      );
    }

    const result = await withClient(async (client) => {
      await client.query("BEGIN");

      try {
        const before = await tableCounts(client);
        await client.query(`TRUNCATE ${OPERATIONAL_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
        const after = await tableCounts(client);
        await client.query("COMMIT");

        return {
          before,
          after,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });

    return NextResponse.json({
      ok: true,
      message: "Dados operacionais limpos com sucesso.",
      tables: OPERATIONAL_TABLES,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao limpar dados operacionais.",
      },
      { status: 400 },
    );
  }
}
