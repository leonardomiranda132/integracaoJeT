import { NextResponse } from "next/server";
import { getOrderDetail } from "../../../../../lib/server/queries";

interface RouteProps {
  params: Promise<{
    branchCode: string;
    orderCode: string;
  }>;
}

export async function GET(_request: Request, { params }: RouteProps) {
  const { branchCode, orderCode } = await params;
  const detail = await getOrderDetail(Number(branchCode), Number(orderCode));
  return NextResponse.json(detail);
}
