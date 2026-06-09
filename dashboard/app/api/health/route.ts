import { NextResponse } from "next/server";
import { isPostgresSslEnabled } from "../../../lib/server/db";

export const dynamic = "force-dynamic";

function getDatabaseUrlKind(): "unset" | "local" | "remote" | "invalid" {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

  if (!connectionString) {
    return "unset";
  }

  try {
    const hostname = new URL(connectionString).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" ? "local" : "remote";
  } catch {
    return "invalid";
  }
}

export function GET() {
  const databaseConfigured = Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);

  return NextResponse.json({
    status: "ok",
    service: "integracao-jt-dashboard",
    databaseConfigured,
    databaseUrlKind: getDatabaseUrlKind(),
    postgresSsl: databaseConfigured ? isPostgresSslEnabled() : false,
    vercelRuntime: process.env.VERCEL === "1" || process.env.VERCEL === "true",
    timestamp: new Date().toISOString(),
  });
}
