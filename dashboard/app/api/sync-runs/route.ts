import { NextResponse } from "next/server";
import { listRecentRuns } from "../../../lib/server/queries";

export async function GET() {
  return NextResponse.json(await listRecentRuns(20));
}
