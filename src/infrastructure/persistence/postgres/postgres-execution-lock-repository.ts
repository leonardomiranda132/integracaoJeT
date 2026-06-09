import { randomUUID } from "node:crypto";
import type { ExecutionLockRepository } from "../repositories/execution-lock-repository.js";
import type { PostgresDatabase } from "./postgres-database.js";

interface InsertLockRow {
  lock_key: string;
}

export class PostgresExecutionLockRepository implements ExecutionLockRepository {
  private readonly ownerId = randomUUID();

  constructor(private readonly db: PostgresDatabase) {}

  async acquire(lockKey: string): Promise<boolean> {
    const result = await this.db.query<InsertLockRow>(
      `
        INSERT INTO execution_locks (lock_key, owner_id)
        VALUES ($1, $2)
        ON CONFLICT (lock_key) DO NOTHING
        RETURNING lock_key
      `,
      [lockKey, this.ownerId],
    );

    return result.rowCount === 1;
  }

  async release(lockKey: string): Promise<void> {
    await this.db.query(
      `
        DELETE FROM execution_locks
        WHERE lock_key = $1 AND owner_id = $2
      `,
      [lockKey, this.ownerId],
    );
  }
}
