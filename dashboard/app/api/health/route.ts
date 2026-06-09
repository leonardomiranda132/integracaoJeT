import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "integracao-jt-dashboard",
    databaseConfigured: Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL),
    postgresSsl: process.env.POSTGRES_SSL === "true",
    timestamp: new Date().toISOString(),
  });
}
