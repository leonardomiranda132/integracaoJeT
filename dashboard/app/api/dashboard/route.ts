import { NextResponse } from "next/server";
import { getDashboardMetrics, getFlowBlocks, getLatestRun, listRecentRuns } from "../../../lib/server/queries";

export async function GET() {
  const latestRun = await getLatestRun();
  const [metrics, flowBlocks, recentRuns] = await Promise.all([
    getDashboardMetrics(),
    getFlowBlocks(latestRun?.id),
    listRecentRuns(),
  ]);

  return NextResponse.json({
    latestRun,
    metrics,
    flowBlocks,
    recentRuns,
  });
}
