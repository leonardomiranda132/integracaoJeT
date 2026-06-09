import { randomUUID } from "node:crypto";
import type { SyncRun } from "../../../domain/models/sync-run.js";
import type { TimeWindow } from "../../../shared/types.js";
import type { MemoryDatabase } from "./memory-database.js";
import type { SyncRunsRepository } from "../repositories/sync-runs-repository.js";

export class MemorySyncRunsRepository implements SyncRunsRepository {
  constructor(private readonly db: MemoryDatabase) {}

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

    this.db.syncRuns.push(syncRun);
    return syncRun;
  }

  async finish(syncRunId: string, updates: Partial<SyncRun>): Promise<void> {
    const syncRun = this.db.syncRuns.find((item) => item.id === syncRunId);
    if (!syncRun) return;

    Object.assign(syncRun, updates, {
      finishedAt: new Date().toISOString(),
    });
  }

  async getLastSuccessfulWindowEnd(): Promise<string | null> {
    const successful = [...this.db.syncRuns]
      .filter((item) => item.status === "succeeded" && item.finishedAt)
      .sort((a, b) => (a.finishedAt! < b.finishedAt! ? 1 : -1))[0];

    return successful?.windowEnd ?? null;
  }
}
