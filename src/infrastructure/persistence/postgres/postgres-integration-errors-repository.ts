import { sanitizeForLogging } from "../../logging/sanitizer.js";
import type { IntegrationErrorsRepository } from "../repositories/integration-errors-repository.js";
import { toJsonb } from "./json.js";
import type { PostgresDatabase } from "./postgres-database.js";

interface ErrorContext {
  branchCode?: unknown;
  orderCode?: unknown;
  txlogisticId?: unknown;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export class PostgresIntegrationErrorsRepository
  implements IntegrationErrorsRepository
{
  constructor(private readonly db: PostgresDatabase) {}

  async save(error: {
    source: string;
    message: string;
    context?: Record<string, unknown>;
  }): Promise<void> {
    const context: ErrorContext = error.context ?? {};
    const sanitizedContext = sanitizeForLogging(error.context ?? {});

    await this.db.query(
      `
        INSERT INTO integration_errors (
          source,
          message,
          branch_code,
          order_code,
          txlogistic_id,
          context
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        error.source,
        error.message,
        toOptionalNumber(context.branchCode),
        toOptionalNumber(context.orderCode),
        typeof context.txlogisticId === "string" ? context.txlogisticId : undefined,
        toJsonb(sanitizedContext),
      ],
    );
  }
}
