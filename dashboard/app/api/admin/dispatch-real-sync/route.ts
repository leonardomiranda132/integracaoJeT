import { NextRequest, NextResponse } from "next/server";
import { assertConfirmation, assertOperationsToken } from "../../../../lib/server/admin-actions";
import { dispatchRealSyncWorkflow } from "../../../../lib/server/github-actions";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      actionToken?: unknown;
      confirmation?: unknown;
      dailySendLimit?: unknown;
    };

    assertOperationsToken(request, body.actionToken);
    assertConfirmation(body.confirmation, "ENVIAR REAL");

    return NextResponse.json(
      await dispatchRealSyncWorkflow({
        dailySendLimit: body.dailySendLimit,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao disparar envio real.",
      },
      { status: 400 },
    );
  }
}
