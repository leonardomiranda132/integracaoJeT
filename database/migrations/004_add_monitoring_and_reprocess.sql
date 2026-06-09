CREATE TABLE IF NOT EXISTS operational_issues (
  id uuid PRIMARY KEY,
  issue_key text NOT NULL UNIQUE,
  branch_code integer NOT NULL,
  order_code bigint NOT NULL,
  txlogistic_id text,
  issue_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL CHECK (status IN ('open', 'resolved', 'ignored')),
  reason text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operational_issues_status_last_seen_idx
  ON operational_issues (status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS operational_issues_order_idx
  ON operational_issues (branch_code, order_code);

CREATE INDEX IF NOT EXISTS operational_issues_type_reason_idx
  ON operational_issues (issue_type, reason);

CREATE TABLE IF NOT EXISTS order_overrides (
  id uuid PRIMARY KEY,
  branch_code integer NOT NULL,
  order_code bigint NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  patch jsonb NOT NULL,
  reason text NOT NULL,
  created_by text NOT NULL DEFAULT 'operator',
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS order_overrides_one_active_order_idx
  ON order_overrides (branch_code, order_code)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS order_overrides_order_idx
  ON order_overrides (branch_code, order_code);

CREATE TABLE IF NOT EXISTS order_processing_events (
  id bigserial PRIMARY KEY,
  event_time timestamptz NOT NULL DEFAULT now(),
  sync_run_id uuid REFERENCES sync_runs (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  branch_code integer,
  order_code bigint,
  txlogistic_id text,
  status text NOT NULL,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS order_processing_events_time_idx
  ON order_processing_events (event_time DESC);

CREATE INDEX IF NOT EXISTS order_processing_events_order_idx
  ON order_processing_events (branch_code, order_code, event_time DESC);

CREATE INDEX IF NOT EXISTS order_processing_events_sync_run_idx
  ON order_processing_events (sync_run_id, event_time DESC);

CREATE TABLE IF NOT EXISTS reprocess_requests (
  id uuid PRIMARY KEY,
  branch_code integer NOT NULL,
  order_code bigint NOT NULL,
  txlogistic_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'canceled')),
  requested_by text NOT NULL DEFAULT 'operator',
  reason text NOT NULL,
  jt_send_enabled boolean NOT NULL DEFAULT false,
  force_send boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reprocess_requests_one_active_order_idx
  ON reprocess_requests (branch_code, order_code)
  WHERE status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS reprocess_requests_status_created_idx
  ON reprocess_requests (status, created_at);

CREATE INDEX IF NOT EXISTS reprocess_requests_order_idx
  ON reprocess_requests (branch_code, order_code);

CREATE TABLE IF NOT EXISTS reprocess_attempts (
  id uuid PRIMARY KEY,
  request_id uuid REFERENCES reprocess_requests (id) ON DELETE SET NULL,
  branch_code integer NOT NULL,
  order_code bigint NOT NULL,
  txlogistic_id text,
  status text NOT NULL CHECK (
    status IN ('succeeded', 'failed', 'dry-run', 'already-created')
  ),
  jt_send_enabled boolean NOT NULL,
  force_send boolean NOT NULL DEFAULT false,
  payload jsonb,
  response jsonb,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reprocess_attempts_request_idx
  ON reprocess_attempts (request_id, started_at DESC);

CREATE INDEX IF NOT EXISTS reprocess_attempts_order_idx
  ON reprocess_attempts (branch_code, order_code, started_at DESC);
