import { randomUUID } from "node:crypto";
import { sanitizeForLogging } from "../../logging/sanitizer.js";
import type {
  OperationalIssueInput,
  OperationalIssuesRepository,
} from "../repositories/operational-issues-repository.js";
import { toJsonb } from "./json.js";
import type { PostgresDatabase } from "./postgres-database.js";

export class PostgresOperationalIssuesRepository
  implements OperationalIssuesRepository
{
  constructor(private readonly db: PostgresDatabase) {}

  async upsertOpen(issue: OperationalIssueInput): Promise<void> {
    await this.db.query(
      `
        INSERT INTO operational_issues (
          id,
          issue_key,
          branch_code,
          order_code,
          txlogistic_id,
          issue_type,
          severity,
          status,
          reason,
          details,
          first_seen_at,
          last_seen_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, $9, now(), now())
        ON CONFLICT (issue_key)
        DO UPDATE SET
          txlogistic_id = EXCLUDED.txlogistic_id,
          issue_type = EXCLUDED.issue_type,
          severity = EXCLUDED.severity,
          status = 'open',
          reason = EXCLUDED.reason,
          details = EXCLUDED.details,
          last_seen_at = now(),
          resolved_at = NULL,
          resolution_note = NULL,
          updated_at = now()
      `,
      [
        randomUUID(),
        issue.issueKey,
        issue.branchCode,
        issue.orderCode,
        issue.txlogisticId,
        issue.issueType,
        issue.severity,
        issue.reason,
        toJsonb(sanitizeForLogging(issue.details ?? {})),
      ],
    );
  }

  async resolveByOrder(
    branchCode: number,
    orderCode: number,
    resolutionNote: string,
  ): Promise<void> {
    await this.db.query(
      `
        UPDATE operational_issues
        SET
          status = 'resolved',
          resolved_at = now(),
          resolution_note = $3,
          updated_at = now()
        WHERE branch_code = $1
          AND order_code = $2
          AND status = 'open'
      `,
      [branchCode, orderCode, resolutionNote],
    );
  }
}
