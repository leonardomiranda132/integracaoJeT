import { NextRequest, NextResponse } from "next/server";
import { dispatchRealSyncWorkflow } from "../../../../lib/server/github-actions";

export const dynamic = "force-dynamic";

function assertCronSecret(request: NextRequest): void {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    throw new Error("Cron nao autorizado.");
  }
}

export async function GET(request: NextRequest) {
  try {
    assertCronSecret(request);

    const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

    return NextResponse.json(
      await dispatchRealSyncWorkflow({
        dailySendLimit: process.env.CRON_DAILY_SEND_LIMIT ?? process.env.DAILY_SEND_LIMIT ?? "",
        dryRun,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao disparar cron diario.",
      },
      { status: 401 },
    );
  }
}
