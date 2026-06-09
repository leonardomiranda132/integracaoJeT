import { NextResponse } from "next/server";
import { getLatestExportRows } from "../../../../lib/server/queries";

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const rows = await getLatestExportRows();
  const headers = [
    "branchCode",
    "orderCode",
    "txlogisticId",
    "customerName",
    "statusOrder",
    "shippingCompanyCode",
    "shippingCompanyName",
    "invoiceNumber",
    "totalAmountOrder",
    "pickupStatus",
    "billCode",
    "openIssueReason",
  ];

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => escapeCsv(row[header as keyof typeof row]))
        .join(","),
    ),
  ].join("\n");

  return new NextResponse(`${csv}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orders-latest.csv"',
    },
  });
}
