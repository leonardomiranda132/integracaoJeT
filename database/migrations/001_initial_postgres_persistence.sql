CREATE TABLE IF NOT EXISTS sync_runs (
  id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  orders_read integer NOT NULL DEFAULT 0,
  pickups_created integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sync_runs_status_finished_at_idx
  ON sync_runs (status, finished_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id bigserial PRIMARY KEY,
  branch_code integer NOT NULL,
  order_code bigint NOT NULL,
  order_id text,
  customer_code bigint,
  customer_name text NOT NULL,
  customer_cpf_cnpj text,
  customer_phone text,
  customer_mobile text,
  shipping_company_code integer,
  shipping_company_name text,
  shipping_service text,
  status_order text NOT NULL,
  max_change_filter_date text NOT NULL,
  total_amount_order numeric(14, 2),
  invoice_number text,
  invoice_serial_number text,
  invoice_access_key text,
  invoice_money numeric(14, 2),
  shipping_address jsonb,
  phones jsonb NOT NULL DEFAULT '[]'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  invoices jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_order jsonb NOT NULL,
  internal_status text NOT NULL DEFAULT 'found',
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_branch_order_unique UNIQUE (branch_code, order_code)
);

CREATE INDEX IF NOT EXISTS orders_status_order_idx
  ON orders (status_order);

CREATE INDEX IF NOT EXISTS orders_shipping_company_code_idx
  ON orders (shipping_company_code);

CREATE TABLE IF NOT EXISTS pickup_requests (
  id uuid PRIMARY KEY,
  txlogistic_id text NOT NULL,
  branch_code integer,
  order_code bigint,
  bill_code text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  request_payload jsonb,
  raw_response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pickup_requests_txlogistic_id_unique UNIQUE (txlogistic_id)
);

CREATE INDEX IF NOT EXISTS pickup_requests_branch_order_idx
  ON pickup_requests (branch_code, order_code);

CREATE TABLE IF NOT EXISTS integration_errors (
  id bigserial PRIMARY KEY,
  source text NOT NULL,
  message text NOT NULL,
  branch_code integer,
  order_code bigint,
  txlogistic_id text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_errors_created_at_idx
  ON integration_errors (created_at DESC);

CREATE INDEX IF NOT EXISTS integration_errors_order_idx
  ON integration_errors (branch_code, order_code);

CREATE INDEX IF NOT EXISTS integration_errors_txlogistic_id_idx
  ON integration_errors (txlogistic_id);
