import { NextResponse } from "next/server";
import { getDatabaseConnectionInfo, isPostgresSslEnabled } from "../../../lib/server/db";

export const dynamic = "force-dynamic";

export function GET() {
  const database = getDatabaseConnectionInfo();

  return NextResponse.json({
    status: "ok",
    service: "integracao-jt-dashboard",
    databaseConfigured: database.configured,
    databaseUrlKind: database.kind,
    selectedDatabaseSource: database.source,
    postgresSsl: database.configured ? isPostgresSslEnabled() : false,
    vercelRuntime: process.env.VERCEL === "1" || process.env.VERCEL === "true",
    timestamp: new Date().toISOString(),
  });
}
