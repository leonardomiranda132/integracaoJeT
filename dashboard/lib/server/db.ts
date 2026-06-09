import pg from "pg";

const { Pool } = pg;

type ConnectionStringSource = "DATABASE_URL" | "POSTGRES_URL";
type ConnectionStringKind = "local" | "remote" | "invalid";

declare global {
  // eslint-disable-next-line no-var
  var __operationsDashboardPool: pg.Pool | undefined;
}

function classifyConnectionString(value: string): ConnectionStringKind {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" ? "local" : "remote";
  } catch {
    return "invalid";
  }
}

export function getDatabaseConnectionInfo(): {
  configured: boolean;
  kind: ConnectionStringKind | "unset";
  source: ConnectionStringSource | null;
} {
  const candidates = [
    { source: "DATABASE_URL" as const, value: process.env.DATABASE_URL },
    { source: "POSTGRES_URL" as const, value: process.env.POSTGRES_URL },
  ]
    .filter((candidate): candidate is { source: ConnectionStringSource; value: string } =>
      Boolean(candidate.value),
    )
    .map((candidate) => ({
      ...candidate,
      kind: classifyConnectionString(candidate.value),
    }));

  if (candidates.length === 0) {
    return {
      configured: false,
      kind: "unset",
      source: null,
    };
  }

  const remoteCandidate = candidates.find((candidate) => candidate.kind === "remote");
  const selected = isVercelRuntime() && remoteCandidate ? remoteCandidate : candidates[0];

  return {
    configured: true,
    kind: selected.kind,
    source: selected.source,
  };
}

function getConnectionString(): string {
  const info = getDatabaseConnectionInfo();
  const connectionString =
    info.source === "DATABASE_URL"
      ? process.env.DATABASE_URL
      : info.source === "POSTGRES_URL"
        ? process.env.POSTGRES_URL
        : undefined;

  if (!connectionString) {
    throw new Error("Configure DATABASE_URL ou POSTGRES_URL para usar a interface.");
  }

  return connectionString;
}

function hasExplicitSslDisable(): boolean {
  return process.env.POSTGRES_SSL_FORCE_DISABLE === "true";
}

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

function connectionStringRequestsSsl(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode");
    const ssl = url.searchParams.get("ssl");

    return ssl === "true" || sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full";
  } catch {
    return false;
  }
}

export function isPostgresSslEnabled(): boolean {
  if (hasExplicitSslDisable()) {
    return false;
  }

  const connectionString = getConnectionString();

  if (process.env.POSTGRES_SSL === "true") {
    return true;
  }

  return isVercelRuntime() || connectionStringRequestsSsl(connectionString);
}

function createPool(): pg.Pool {
  const ssl = isPostgresSslEnabled();
  const rejectUnauthorized = process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== "false";

  return new Pool({
    connectionString: getConnectionString(),
    allowExitOnIdle: false,
    max: Number(process.env.POSTGRES_POOL_MAX ?? "10"),
    ssl: ssl ? { rejectUnauthorized } : undefined,
  });
}

export function getPool(): pg.Pool {
  if (!global.__operationsDashboardPool) {
    global.__operationsDashboardPool = createPool();
  }

  return global.__operationsDashboardPool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function withClient<T>(
  handler: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();

  try {
    return await handler(client);
  } finally {
    client.release();
  }
}
