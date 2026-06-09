import type { SyncRun } from "../../../domain/models/sync-run.js";
import type { TimeWindow } from "../../../shared/types.js";

export interface SyncRunsRepository {
  start(window: TimeWindow): Promise<SyncRun>;
  finish(syncRunId: string, updates: Partial<SyncRun>): Promise<void>;
  getLastSuccessfulWindowEnd(): Promise<string | null>;
}
