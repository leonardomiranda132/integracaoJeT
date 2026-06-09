export interface ExecutionLockRepository {
  acquire(lockKey: string): Promise<boolean>;
  release(lockKey: string): Promise<void>;
}
