import { randomUUID } from "node:crypto";
import type { SyncRun } from "../../../domain/models/sync-run.js";
import type { TimeWindow } from "../../../shared/types.js";
import type { SyncRunsRepository } from "../repositories/sync-runs-repository.js";
import type { PostgresDatabase } from "./postgres-database.js";

interface SyncRunWindowRow {
  window_end: Date | string;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export class PostgresSyncRunsRepository implements SyncRunsRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async start(window: TimeWindow): Promise<SyncRun> {
    const syncRun: SyncRun = {
      id: randomUUID(),
      startedAt: new Date().toISOString(),
      status: "running",
      windowStart: window.startDate,
      windowEnd: window.endDate,
      pagesRead: 0,
      ordersRead: 0,
      pickupsCreated: 0,
      errors: 0,
    };

    await this.db.query(
      `
        INSERT INTO sync_runs (
          id,
          started_at,
          status,
          window_start,
          window_end,
          pages_read,
          orders_read,
          pickups_created,
          errors
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        syncRun.id,
        syncRun.startedAt,
        syncRun.status,
        syncRun.windowStart,
        syncRun.windowEnd,
        syncRun.pagesRead,
        syncRun.ordersRead,
        syncRun.pickupsCreated,
        syncRun.errors,
      ],
    );

    return syncRun;
  }

  async finish(syncRunId: string, updates: Partial<SyncRun>): Promise<void> {
    await this.db.query(
      `
        UPDATE sync_runs
        SET
          finished_at = $2,
          status = COALESCE($3, status),
          pages_read = COALESCE($4, pages_read),
          orders_read = COALESCE($5, orders_read),
          pickups_created = COALESCE($6, pickups_created),
          errors = COALESCE($7, errors),
          updated_at = now()
        WHERE id = $1
      `,
      [
        syncRunId,
        new Date().toISOString(),
        updates.status,
        updates.pagesRead,
        updates.ordersRead,
        updates.pickupsCreated,
        updates.errors,
      ],
    );
  }

  async getLastSuccessfulWindowEnd(): Promise<string | null> {
    const result = await this.db.query<SyncRunWindowRow>(
      `
        SELECT window_end
        FROM sync_runs
        WHERE status = 'succeeded' AND finished_at IS NOT NULL
        ORDER BY finished_at DESC
        LIMIT 1
      `,
    );

    const row = result.rows[0];
    return row ? toIsoString(row.window_end) : null;
  }
}
