import { NextResponse } from "next/server";
import { listIssues } from "../../../lib/server/queries";

export async function GET() {
  return NextResponse.json(await listIssues(200));
}
