import { sanitizeForLogging } from "../../logging/sanitizer.js";
import type { MemoryDatabase } from "./memory-database.js";
import type { IntegrationErrorsRepository } from "../repositories/integration-errors-repository.js";

export class MemoryIntegrationErrorsRepository
  implements IntegrationErrorsRepository
{
  constructor(private readonly db: MemoryDatabase) {}

  async save(error: {
    source: string;
    message: string;
    context?: Record<string, unknown>;
  }): Promise<void> {
    const sanitizedContext = error.context
      ? sanitizeForLogging(error.context)
      : undefined;

    this.db.errors.push({
      ...error,
      context: sanitizedContext,
    });
  }
}
