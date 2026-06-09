import { query } from "./db";
import type {
  DashboardMetrics,
  FlowBlock,
  IssueListItem,
  LatestRunSummary,
  OrderDetail,
  OrderListItem,
  OrdersFilters,
  ReprocessRequestItem,
} from "../types";

function asIso(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function asNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value) || 0;
}

function sanitizeRecord(value: Record<string, unknown>): Record<string, unknown> {
  const entries = Object.entries(value).map(([key, current]) => {
    if (current instanceof Date) {
      return [key, current.toISOString()];
    }

    return [key, current];
  });

  return Object.fromEntries(entries);
}

export async function getLatestRun(): Promise<LatestRunSummary | null> {
  const rows = await query<{
    id: string;
    status: string;
    started_at: Date | string;
    finished_at: Date | string | null;
    window_start: Date | string;
    window_end: Date | string;
    pages_read: number;
    orders_read: number;
    pickups_created: number;
    errors: number;
  }>(
    `
      SELECT
        id,
        status,
        started_at,
        finished_at,
        window_start,
        window_end,
        pages_read,
        orders_read,
        pickups_created,
        errors
      FROM sync_runs
      ORDER BY started_at DESC
      LIMIT 1
    `,
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: row.status,
    startedAt: asIso(row.started_at) ?? "",
    finishedAt: asIso(row.finished_at),
    windowStart: asIso(row.window_start) ?? "",
    windowEnd: asIso(row.window_end) ?? "",
    pagesRead: row.pages_read,
    ordersRead: row.orders_read,
    pickupsCreated: row.pickups_created,
    errors: row.errors,
  };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [runRows, issueRows, reprocessRows, dryRunRows] = await Promise.all([
    query<{
      runs: string;
      orders_read: string;
      pickups_created: string;
      errors: string;
    }>(
      `
        SELECT
          count(*) AS runs,
          COALESCE(sum(orders_read), 0) AS orders_read,
          COALESCE(sum(pickups_created), 0) AS pickups_created,
          COALESCE(sum(errors), 0) AS errors
        FROM sync_runs
        WHERE started_at >= now() - interval '7 day'
      `,
    ),
    query<{ open_issues: string }>(
      `
        SELECT count(*) AS open_issues
        FROM operational_issues
        WHERE status = 'open'
      `,
    ),
    query<{ pending_reprocess: string }>(
      `
        SELECT count(*) AS pending_reprocess
        FROM reprocess_requests
        WHERE status IN ('pending', 'running')
      `,
    ),
    query<{ pickups_dry_run: string }>(
      `
        SELECT count(*) AS pickups_dry_run
        FROM order_processing_events
        WHERE event_type = 'pickup-dry-run'
          AND event_time >= now() - interval '7 day'
      `,
    ),
  ]);

  return {
    runs: asNumber(runRows[0]?.runs),
    ordersRead: asNumber(runRows[0]?.orders_read),
    pickupsCreated: asNumber(runRows[0]?.pickups_created),
    errors: asNumber(runRows[0]?.errors),
    openIssues: asNumber(issueRows[0]?.open_issues),
    pendingReprocess: asNumber(reprocessRows[0]?.pending_reprocess),
    pickupsDryRun: asNumber(dryRunRows[0]?.pickups_dry_run),
  };
}

export async function getFlowBlocks(latestRunId?: string): Promise<FlowBlock[]> {
  if (!latestRunId) {
    return [
      {
        id: "totvs",
        label: "TOTVS",
        description: "Nenhum lote registrado ainda.",
        count: 0,
        tone: "default",
      },
    ];
  }

  const [totalsRows, eventRows, issueRows, reprocessRows] = await Promise.all([
    query<{
      pages_read: number;
      orders_read: number;
      pickups_created: number;
      errors: number;
    }>(
      `
        SELECT pages_read, orders_read, pickups_created, errors
        FROM sync_runs
        WHERE id = $1
        LIMIT 1
      `,
      [latestRunId],
    ),
    query<{ event_type: string; total: string }>(
      `
        SELECT event_type, count(*) AS total
        FROM order_processing_events
        WHERE sync_run_id = $1
        GROUP BY event_type
      `,
      [latestRunId],
    ),
    query<{ open_issues: string }>(
      `
        SELECT count(*) AS open_issues
        FROM operational_issues
        WHERE status = 'open'
      `,
    ),
    query<{ pending_reprocess: string }>(
      `
        SELECT count(*) AS pending_reprocess
        FROM reprocess_requests
        WHERE status IN ('pending', 'running')
      `,
    ),
  ]);

  const totals = totalsRows[0];
  const events = new Map(eventRows.map((row) => [row.event_type, asNumber(row.total)]));
  const eligibleCount =
    (events.get("pickup-dry-run") ?? 0) + (events.get("pickup-created") ?? 0);

  return [
    {
      id: "totvs",
      label: "TOTVS",
      description: "Pedidos lidos na janela mais recente.",
      count: totals?.orders_read ?? 0,
      tone: "default",
      href: "/orders",
    },
    {
      id: "pagination",
      label: "Paginacao",
      description: "Paginas lidas. O pageSize 100 nao e teto unico.",
      count: totals?.pages_read ?? 0,
      tone: "default",
      href: "/orders",
    },
    {
      id: "eligibility",
      label: "Elegibilidade",
      description: "Pedidos aptos depois dos filtros operacionais.",
      count: eligibleCount,
      tone: "default",
      href: "/issues",
    },
    {
      id: "payload",
      label: "Payload J&T",
      description: "Payloads validados antes de qualquer envio.",
      count: eligibleCount,
      tone: "success",
      href: "/orders",
    },
    {
      id: "send-lock",
      label: "Envio unico",
      description: "Reserva por txlogistic_id antes da chamada externa.",
      count: totals?.pickups_created ?? 0,
      tone: (totals?.pickups_created ?? 0) > 0 ? "success" : "warning",
      href: "/reprocess",
    },
    {
      id: "persistence",
      label: "Banco",
      description: "Eventos e snapshots salvos para auditoria.",
      count: events.get("pickup-dry-run") ?? 0,
      tone: "default",
      href: "/orders",
    },
    {
      id: "issues",
      label: "Pendências",
      description: "Pendências abertas para ação operacional.",
      count: asNumber(issueRows[0]?.open_issues),
      tone: asNumber(issueRows[0]?.open_issues) > 0 ? "danger" : "default",
      href: "/issues",
    },
    {
      id: "reprocess",
      label: "Reprocessar",
      description: "Fila manual para pedidos com pendencia aberta.",
      count: asNumber(reprocessRows[0]?.pending_reprocess),
      tone: asNumber(reprocessRows[0]?.pending_reprocess) > 0 ? "warning" : "default",
      href: "/reprocess",
    },
  ];
}

export async function listRecentRuns(limit = 6): Promise<LatestRunSummary[]> {
  const rows = await query<{
    id: string;
    status: string;
    started_at: Date | string;
    finished_at: Date | string | null;
    window_start: Date | string;
    window_end: Date | string;
    pages_read: number;
    orders_read: number;
    pickups_created: number;
    errors: number;
  }>(
    `
      SELECT
        id,
        status,
        started_at,
        finished_at,
        window_start,
        window_end,
        pages_read,
        orders_read,
        pickups_created,
        errors
      FROM sync_runs
      ORDER BY started_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    startedAt: asIso(row.started_at) ?? "",
    finishedAt: asIso(row.finished_at),
    windowStart: asIso(row.window_start) ?? "",
    windowEnd: asIso(row.window_end) ?? "",
    pagesRead: row.pages_read,
    ordersRead: row.orders_read,
    pickupsCreated: row.pickups_created,
    errors: row.errors,
  }));
}

export async function listOrders(filters: OrdersFilters = {}): Promise<OrderListItem[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.branchCode) {
    params.push(filters.branchCode);
    where.push(`o.branch_code = $${params.length}`);
  }

  if (filters.orderCode) {
    params.push(filters.orderCode);
    where.push(`o.order_code = $${params.length}`);
  }

  if (filters.statusOrder) {
    params.push(filters.statusOrder);
    where.push(`o.status_order = $${params.length}`);
  }

  if (filters.issueStatus) {
    params.push(filters.issueStatus);
    where.push(`COALESCE(oi.status, 'resolved') = $${params.length}`);
  }

  if (filters.issueSeverity) {
    params.push(filters.issueSeverity);
    where.push(`oi.severity = $${params.length}`);
  }

  if (filters.query) {
    params.push(`%${filters.query}%`);
    const index = params.length;
    where.push(
      `(CAST(o.order_code AS text) ILIKE $${index} OR o.customer_name ILIKE $${index} OR COALESCE(p.txlogistic_id, '') ILIKE $${index} OR COALESCE(p.bill_code, '') ILIKE $${index})`,
    );
  }

  params.push(filters.limit ?? 50);

  const rows = await query<{
    branch_code: number;
    order_code: string;
    txlogistic_id: string | null;
    customer_name: string;
    status_order: string;
    internal_status: string;
    shipping_company_code: number | null;
    shipping_company_name: string | null;
    invoice_number: string | null;
    total_amount_order: string | null;
    last_synced_at: Date | string;
    pickup_status: string | null;
    bill_code: string | null;
    issue_reason: string | null;
    issue_severity: string | null;
  }>(
    `
      SELECT
        o.branch_code,
        o.order_code,
        COALESCE(p.txlogistic_id, CONCAT(o.branch_code, '-', o.order_code)) AS txlogistic_id,
        o.customer_name,
        o.status_order,
        o.internal_status,
        o.shipping_company_code,
        o.shipping_company_name,
        o.invoice_number,
        o.total_amount_order::text,
        o.last_synced_at,
        p.status AS pickup_status,
        p.bill_code,
        oi.reason AS issue_reason,
        oi.severity AS issue_severity
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT txlogistic_id, status, bill_code
        FROM pickup_requests
        WHERE branch_code = o.branch_code AND order_code = o.order_code
        ORDER BY created_at DESC
        LIMIT 1
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT status, reason, severity
        FROM operational_issues
        WHERE branch_code = o.branch_code AND order_code = o.order_code
        ORDER BY
          CASE status WHEN 'open' THEN 0 WHEN 'resolved' THEN 1 ELSE 2 END,
          last_seen_at DESC
        LIMIT 1
      ) oi ON true
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY o.last_synced_at DESC, o.branch_code, o.order_code
      LIMIT $${params.length}
    `,
    params,
  );

  return rows.map((row) => ({
    branchCode: row.branch_code,
    orderCode: row.order_code,
    txlogisticId: row.txlogistic_id ?? `${row.branch_code}-${row.order_code}`,
    customerName: row.customer_name,
    statusOrder: row.status_order,
    internalStatus: row.internal_status,
    shippingCompanyCode: row.shipping_company_code,
    shippingCompanyName: row.shipping_company_name,
    invoiceNumber: row.invoice_number,
    totalAmountOrder: row.total_amount_order,
    lastSyncedAt: asIso(row.last_synced_at) ?? "",
    pickupStatus: row.pickup_status,
    billCode: row.bill_code,
    openIssueReason: row.issue_reason,
    openIssueSeverity: row.issue_severity,
  }));
}

export async function getOrderDetail(
  branchCode: number,
  orderCode: number,
): Promise<OrderDetail> {
  const params = [branchCode, orderCode];

  const [orders, pickups, issues, errors, events, overrides, reprocessRequests, reprocessAttempts] =
    await Promise.all([
      query<Record<string, unknown>>(
        `
          SELECT *
          FROM orders
          WHERE branch_code = $1 AND order_code = $2
          LIMIT 1
        `,
        params,
      ),
      query<Record<string, unknown>>(
        `
          SELECT *
          FROM pickup_requests
          WHERE branch_code = $1 AND order_code = $2
          ORDER BY created_at DESC
        `,
        params,
      ),
      query<Record<string, unknown>>(
        `
          SELECT *
          FROM operational_issues
          WHERE branch_code = $1 AND order_code = $2
          ORDER BY
            CASE status WHEN 'open' THEN 0 WHEN 'resolved' THEN 1 ELSE 2 END,
            last_seen_at DESC
        `,
        params,
      ),
      query<Record<string, unknown>>(
        `
          SELECT *
          FROM integration_errors
          WHERE branch_code = $1 AND order_code = $2
          ORDER BY created_at DESC
          LIMIT 20
        `,
        params,
      ),
      query<Record<string, unknown>>(
        `
          SELECT *
          FROM order_processing_events
          WHERE branch_code = $1 AND order_code = $2
          ORDER BY event_time DESC
          LIMIT 50
        `,
        params,
      ),
      query<Record<string, unknown>>(
        `
          SELECT *
          FROM order_overrides
          WHERE branch_code = $1 AND order_code = $2
          ORDER BY created_at DESC
          LIMIT 20
        `,
        params,
      ),
      query<Record<string, unknown>>(
        `
          SELECT *
          FROM reprocess_requests
          WHERE branch_code = $1 AND order_code = $2
          ORDER BY created_at DESC
          LIMIT 20
        `,
        params,
      ),
      query<Record<string, unknown>>(
        `
          SELECT *
          FROM reprocess_attempts
          WHERE branch_code = $1 AND order_code = $2
          ORDER BY started_at DESC
          LIMIT 20
        `,
        params,
      ),
    ]);

  return {
    order: orders[0] ? sanitizeRecord(orders[0]) : null,
    pickups: pickups.map(sanitizeRecord),
    operationalIssues: issues.map(sanitizeRecord),
    integrationErrors: errors.map(sanitizeRecord),
    processingEvents: events.map(sanitizeRecord),
    orderOverrides: overrides.map(sanitizeRecord),
    reprocessRequests: reprocessRequests.map(sanitizeRecord),
    reprocessAttempts: reprocessAttempts.map(sanitizeRecord),
    canReprocess: issues.some((issue) => issue.status === "open"),
    reprocessBlockReason: issues.some((issue) => issue.status === "open")
      ? null
      : "Reprocessamento so e liberado para pedido com pendencia operacional aberta.",
  };
}

export async function listIssues(
  limit = 100,
  status?: "open" | "resolved" | "ignored",
): Promise<IssueListItem[]> {
  const params: unknown[] = [];
  const where = status ? `WHERE status = $1` : "";

  if (status) {
    params.push(status);
  }

  params.push(limit);

  const rows = await query<{
    id: string;
    branch_code: number;
    order_code: string;
    txlogistic_id: string | null;
    issue_type: string;
    severity: string;
    status: string;
    reason: string;
    first_seen_at: Date | string;
    last_seen_at: Date | string;
    resolution_note: string | null;
  }>(
    `
      SELECT
        id,
        branch_code,
        order_code,
        txlogistic_id,
        issue_type,
        severity,
        status,
        reason,
        first_seen_at,
        last_seen_at,
        resolution_note
      FROM operational_issues
      ${where}
      ORDER BY
        CASE status WHEN 'open' THEN 0 WHEN 'resolved' THEN 1 ELSE 2 END,
        last_seen_at DESC
      LIMIT $${params.length}
    `,
    params,
  );

  return rows.map((row) => ({
    id: row.id,
    branchCode: row.branch_code,
    orderCode: row.order_code,
    txlogisticId: row.txlogistic_id,
    issueType: row.issue_type,
    severity: row.severity,
    status: row.status,
    reason: row.reason,
    firstSeenAt: asIso(row.first_seen_at) ?? "",
    lastSeenAt: asIso(row.last_seen_at) ?? "",
    resolutionNote: row.resolution_note,
  }));
}

export async function listReprocessRequests(limit = 100): Promise<ReprocessRequestItem[]> {
  const rows = await query<{
    id: string;
    branch_code: number;
    order_code: string;
    txlogistic_id: string | null;
    status: string;
    reason: string;
    requested_by: string;
    attempts: number;
    jt_send_enabled: boolean;
    force_send: boolean;
    created_at: Date | string;
    started_at: Date | string | null;
    finished_at: Date | string | null;
    last_error: string | null;
  }>(
    `
      SELECT
        id,
        branch_code,
        order_code,
        txlogistic_id,
        status,
        reason,
        requested_by,
        attempts,
        jt_send_enabled,
        force_send,
        created_at,
        started_at,
        finished_at,
        last_error
      FROM reprocess_requests
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    branchCode: row.branch_code,
    orderCode: row.order_code,
    txlogisticId: row.txlogistic_id,
    status: row.status,
    reason: row.reason,
    requestedBy: row.requested_by,
    attempts: row.attempts,
    jtSendEnabled: row.jt_send_enabled,
    forceSend: row.force_send,
    createdAt: asIso(row.created_at) ?? "",
    startedAt: asIso(row.started_at),
    finishedAt: asIso(row.finished_at),
    lastError: row.last_error,
  }));
}

export async function getLatestExportRows(): Promise<OrderListItem[]> {
  const latestRun = await getLatestRun();
  if (!latestRun) {
    return [];
  }

  const rows = await query<{
    branch_code: number;
    order_code: string;
    txlogistic_id: string | null;
    customer_name: string;
    status_order: string;
    internal_status: string;
    shipping_company_code: number | null;
    shipping_company_name: string | null;
    invoice_number: string | null;
    total_amount_order: string | null;
    last_synced_at: Date | string;
    pickup_status: string | null;
    bill_code: string | null;
    issue_reason: string | null;
    issue_severity: string | null;
  }>(
    `
      SELECT DISTINCT ON (o.branch_code, o.order_code)
        o.branch_code,
        o.order_code,
        COALESCE(p.txlogistic_id, CONCAT(o.branch_code, '-', o.order_code)) AS txlogistic_id,
        o.customer_name,
        o.status_order,
        o.internal_status,
        o.shipping_company_code,
        o.shipping_company_name,
        o.invoice_number,
        o.total_amount_order::text,
        o.last_synced_at,
        p.status AS pickup_status,
        p.bill_code,
        oi.reason AS issue_reason,
        oi.severity AS issue_severity
      FROM order_processing_events e
      JOIN orders o
        ON o.branch_code = e.branch_code
       AND o.order_code = e.order_code
      LEFT JOIN LATERAL (
        SELECT txlogistic_id, status, bill_code
        FROM pickup_requests
        WHERE branch_code = o.branch_code AND order_code = o.order_code
        ORDER BY created_at DESC
        LIMIT 1
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT status, reason, severity
        FROM operational_issues
        WHERE branch_code = o.branch_code AND order_code = o.order_code
        ORDER BY
          CASE status WHEN 'open' THEN 0 WHEN 'resolved' THEN 1 ELSE 2 END,
          last_seen_at DESC
        LIMIT 1
      ) oi ON true
      WHERE e.sync_run_id = $1
      ORDER BY o.branch_code, o.order_code, e.event_time DESC
    `,
    [latestRun.id],
  );

  return rows.map((row) => ({
    branchCode: row.branch_code,
    orderCode: row.order_code,
    txlogisticId: row.txlogistic_id ?? `${row.branch_code}-${row.order_code}`,
    customerName: row.customer_name,
    statusOrder: row.status_order,
    internalStatus: row.internal_status,
    shippingCompanyCode: row.shipping_company_code,
    shippingCompanyName: row.shipping_company_name,
    invoiceNumber: row.invoice_number,
    totalAmountOrder: row.total_amount_order,
    lastSyncedAt: asIso(row.last_synced_at) ?? "",
    pickupStatus: row.pickup_status,
    billCode: row.bill_code,
    openIssueReason: row.issue_reason,
    openIssueSeverity: row.issue_severity,
  }));
}
