import { NextResponse } from "next/server";
import { createOrderOverride } from "../../../../../../lib/server/mutations";

interface RouteProps {
  params: Promise<{
    branchCode: string;
    orderCode: string;
  }>;
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { branchCode, orderCode } = await params;
    const body = (await request.json()) as {
      reason?: string;
      createdBy?: string;
      patch?: string;
    };

    const patch = JSON.parse(body.patch ?? "{}") as Record<string, unknown>;

    const result = await createOrderOverride({
      branchCode: Number(branchCode),
      orderCode: Number(orderCode),
      patch,
      reason: body.reason?.trim() || "Correcao operacional via interface.",
      createdBy: body.createdBy?.trim() || "operator-ui",
    });

    return NextResponse.json({
      id: result.id,
      message: "Override salvo com sucesso.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao salvar override." },
      { status: 400 },
    );
  }
}
