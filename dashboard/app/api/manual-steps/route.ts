import { NextRequest, NextResponse } from "next/server";
import { listManualSteps, runManualStep } from "../../../lib/server/manual-steps";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ steps: listManualSteps() });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { stepId?: unknown };
    const stepId = typeof body.stepId === "string" ? body.stepId : "";

    const result = await runManualStep(stepId);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao executar passo operacional.",
      },
      { status: 400 },
    );
  }
}
