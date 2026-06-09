import { NextRequest, NextResponse } from "next/server";
import { listOrders } from "../../../lib/server/queries";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const orders = await listOrders({
    branchCode: Number(searchParams.get("branch")) || undefined,
    orderCode: Number(searchParams.get("order")) || undefined,
    statusOrder: searchParams.get("statusOrder") ?? undefined,
    issueSeverity: searchParams.get("issueSeverity") ?? undefined,
    issueStatus:
      (searchParams.get("issueStatus") as "open" | "resolved" | "ignored" | null) ?? undefined,
    query: searchParams.get("q") ?? undefined,
    limit: Number(searchParams.get("limit")) || 50,
  });

  return NextResponse.json(orders);
}
