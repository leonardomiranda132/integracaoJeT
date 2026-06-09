import { NextResponse } from "next/server";
import { createReprocessRequest } from "../../../lib/server/mutations";
import { listReprocessRequests } from "../../../lib/server/queries";

function parseRequiredInteger(value: unknown, label: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Informe ${label} valido.`);
  }

  return parsed;
}

export async function GET() {
  return NextResponse.json(await listReprocessRequests(200));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      branchCode?: unknown;
      orderCode?: unknown;
      reason?: string;
      requestedBy?: string;
    };

    const result = await createReprocessRequest({
      branchCode: parseRequiredInteger(body.branchCode, "filial"),
      orderCode: parseRequiredInteger(body.orderCode, "pedido"),
      reason: body.reason?.trim() || "Reprocessamento solicitado pela interface operacional.",
      requestedBy: body.requestedBy?.trim() || "operator-ui",
      jtSendEnabled: false,
      forceSend: false,
    });

    return NextResponse.json({
      id: result.id,
      message: "Pedido enfileirado em dry-run.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao enfileirar pedido." },
      { status: 400 },
    );
  }
}
