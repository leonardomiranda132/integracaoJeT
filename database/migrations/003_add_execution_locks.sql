CREATE TABLE IF NOT EXISTS execution_locks (
  lock_key text PRIMARY KEY,
  owner_id uuid NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now()
);
