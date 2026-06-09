import type { SyncRunStatus } from "../../shared/types.js";

export interface SyncRun {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: SyncRunStatus;
  windowStart: string;
  windowEnd: string;
  pagesRead: number;
  ordersRead: number;
  pickupsCreated: number;
  errors: number;
}
