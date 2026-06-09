import pg from "pg";

const { Pool } = pg;

declare global {
  // eslint-disable-next-line no-var
  var __operationsDashboardPool: pg.Pool | undefined;
}

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error("Configure DATABASE_URL ou POSTGRES_URL para usar a interface.");
  }

  return connectionString;
}

function createPool(): pg.Pool {
  const ssl = process.env.POSTGRES_SSL === "true";
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
