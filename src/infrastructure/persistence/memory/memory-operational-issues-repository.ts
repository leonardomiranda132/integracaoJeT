import type { MemoryDatabase } from "./memory-database.js";
import type {
  OperationalIssueInput,
  OperationalIssuesRepository,
} from "../repositories/operational-issues-repository.js";

export class MemoryOperationalIssuesRepository
  implements OperationalIssuesRepository
{
  constructor(private readonly db: MemoryDatabase) {}

  async upsertOpen(issue: OperationalIssueInput): Promise<void> {
    const existing = this.db.operationalIssues.find(
      (item) => item.issueKey === issue.issueKey,
    );
    const now = new Date().toISOString();

    if (existing) {
      Object.assign(existing, issue, {
        status: "open" as const,
        lastSeenAt: now,
      });
      return;
    }

    this.db.operationalIssues.push({
      ...issue,
      status: "open",
      firstSeenAt: now,
      lastSeenAt: now,
    });
  }

  async resolveByOrder(
    branchCode: number,
    orderCode: number,
    resolutionNote: string,
  ): Promise<void> {
    for (const issue of this.db.operationalIssues) {
      if (
        issue.branchCode === branchCode &&
        issue.orderCode === orderCode &&
        issue.status === "open"
      ) {
        issue.status = "resolved";
        issue.resolutionNote = resolutionNote;
        issue.lastSeenAt = new Date().toISOString();
      }
    }
  }
}
