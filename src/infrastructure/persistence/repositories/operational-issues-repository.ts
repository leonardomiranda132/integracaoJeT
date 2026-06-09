export type OperationalIssueSeverity = "low" | "medium" | "high" | "critical";

export interface OperationalIssueInput {
  issueKey: string;
  branchCode: number;
  orderCode: number;
  txlogisticId?: string;
  issueType: string;
  severity: OperationalIssueSeverity;
  reason: string;
  details?: Record<string, unknown>;
}

export interface OperationalIssuesRepository {
  upsertOpen(issue: OperationalIssueInput): Promise<void>;
  resolveByOrder(
    branchCode: number,
    orderCode: number,
    resolutionNote: string,
  ): Promise<void>;
}
