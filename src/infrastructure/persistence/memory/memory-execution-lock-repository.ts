import type { ExecutionLockRepository } from "../repositories/execution-lock-repository.js";

const activeLocks = new Set<string>();

export class MemoryExecutionLockRepository implements ExecutionLockRepository {
  async acquire(lockKey: string): Promise<boolean> {
    if (activeLocks.has(lockKey)) {
      return false;
    }

    activeLocks.add(lockKey);
    return true;
  }

  async release(lockKey: string): Promise<void> {
    activeLocks.delete(lockKey);
  }
}
