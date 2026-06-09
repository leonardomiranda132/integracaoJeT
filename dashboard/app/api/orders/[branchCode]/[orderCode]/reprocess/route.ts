import { NextResponse } from "next/server";
import { createReprocessRequest } from "../../../../../../lib/server/mutations";

interface RouteProps {
  params: Promise<{
    branchCode: string;
    orderCode: string;
  }>;
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { branchCode, orderCode } = await params;
    const body = (await request.json()) as { reason?: string; requestedBy?: string };

    const result = await createReprocessRequest({
      branchCode: Number(branchCode),
      orderCode: Number(orderCode),
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
