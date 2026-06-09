import pg from "pg";
import type { PoolConfig, QueryResult, QueryResultRow } from "pg";
import type { PostgresSettings } from "../../../config/settings.js";

const { Pool } = pg;

export class PostgresDatabase {
  constructor(private readonly pool: pg.Pool) {}

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createPostgresDatabase(
  settings: PostgresSettings,
): PostgresDatabase {
  const config: PoolConfig = {
    connectionString: settings.connectionString,
    allowExitOnIdle: true,
    max: settings.poolMax,
  };

  if (settings.ssl) {
    config.ssl = {
      rejectUnauthorized: settings.sslRejectUnauthorized,
    };
  }

  return new PostgresDatabase(new Pool(config));
}
