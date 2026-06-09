import { loadPostgresSettings } from "../../config/settings.js";
import { createPostgresDatabase } from "../../infrastructure/persistence/postgres/postgres-database.js";

interface InspectOptions {
  days: number;
  limit: number;
}

interface SyncRunSummaryRow {
  status: string;
  runs: string;
  pages_read: string | null;
  orders_read: string | null;
  pickups_created: string | null;
  errors: string | null;
  last_finished_at: Date | string | null;
}

interface RecentSyncRunRow {
  id: string;
  started_at: Date | string;
  finished_at: Date | string | null;
  status: string;
  window_start: Date | string;
  window_end: Date | string;
  pages_read: number;
  orders_read: number;
  pickups_created: number;
  errors: number;
}

interface RecentPickupRow {
  created_at: Date | string;
  txlogistic_id: string;
  branch_code: number | null;
  order_code: string | null;
  bill_code: string;
  status: string;
}

interface ErrorSummaryRow {
  source: string;
  errors: string;
  last_error_at: Date | string;
}

interface RecentErrorRow {
  created_at: Date | string;
  source: string;
  branch_code: number | null;
  order_code: string | null;
  txlogistic_id: string | null;
  message: string;
}

interface IssueSummaryRow {
  status: string;
  severity: string;
  issue_type: string;
  issues: string;
  last_seen_at: Date | string;
}

interface RecentIssueRow {
  last_seen_at: Date | string;
  severity: string;
  issue_type: string;
  reason: string;
  branch_code: number;
  order_code: string;
  txlogistic_id: string | null;
}

interface ReprocessSummaryRow {
  status: string;
  requests: string;
  last_created_at: Date | string;
}

interface PendingReprocessRow {
  id: string;
  created_at: Date | string;
  branch_code: number;
  order_code: string;
  txlogistic_id: string | null;
  status: string;
  jt_send_enabled: boolean;
  force_send: boolean;
  reason: string;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptions(argv: string[]): InspectOptions {
  const options: InspectOptions = {
    days: parsePositiveInteger(process.env.INSPECT_DAYS, 7),
    limit: parsePositiveInteger(process.env.INSPECT_LIMIT, 10),
  };

  for (const arg of argv) {
    if (arg.startsWith("--days=")) {
      options.days = parsePositiveInteger(arg.slice("--days=".length), options.days);
    }

    if (arg.startsWith("--limit=")) {
      options.limit = parsePositiveInteger(
        arg.slice("--limit=".length),
        options.limit,
      );
    }
  }

  return options;
}

function formatDate(value: Date | string | null): string {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function shorten(value: string, maxLength = 96): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function asNumber(value: string | number | null): number {
  if (value === null) {
    return 0;
  }

  return Number(value);
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const postgresSettings = loadPostgresSettings();
  const db = createPostgresDatabase(postgresSettings);
  const intervalParams = [options.days];
  const limitParams = [options.days, options.limit];

  try {
    console.info(
      `Resumo operacional Postgres - ultimos ${options.days} dia(s), limite ${options.limit}`,
    );

    const syncSummary = await db.query<SyncRunSummaryRow>(
      `
        SELECT
          status,
          count(*) AS runs,
          COALESCE(sum(pages_read), 0) AS pages_read,
          COALESCE(sum(orders_read), 0) AS orders_read,
          COALESCE(sum(pickups_created), 0) AS pickups_created,
          COALESCE(sum(errors), 0) AS errors,
          max(finished_at) AS last_finished_at
        FROM sync_runs
        WHERE started_at >= now() - ($1::int * interval '1 day')
        GROUP BY status
        ORDER BY status
      `,
      intervalParams,
    );

    console.info("\nSync runs por status");
    console.table(
      syncSummary.rows.map((row) => ({
        status: row.status,
        runs: asNumber(row.runs),
        pagesRead: asNumber(row.pages_read),
        ordersRead: asNumber(row.orders_read),
        pickupsCreated: asNumber(row.pickups_created),
        errors: asNumber(row.errors),
        lastFinishedAt: formatDate(row.last_finished_at),
      })),
    );

    const recentRuns = await db.query<RecentSyncRunRow>(
      `
        SELECT
          id,
          started_at,
          finished_at,
          status,
          window_start,
          window_end,
          pages_read,
          orders_read,
          pickups_created,
          errors
        FROM sync_runs
        WHERE started_at >= now() - ($1::int * interval '1 day')
        ORDER BY started_at DESC
        LIMIT $2
      `,
      limitParams,
    );

    console.info("\nSync runs recentes");
    console.table(
      recentRuns.rows.map((row) => ({
        id: row.id,
        status: row.status,
        startedAt: formatDate(row.started_at),
        finishedAt: formatDate(row.finished_at),
        windowStart: formatDate(row.window_start),
        windowEnd: formatDate(row.window_end),
        pagesRead: row.pages_read,
        ordersRead: row.orders_read,
        pickupsCreated: row.pickups_created,
        errors: row.errors,
      })),
    );

    const recentPickups = await db.query<RecentPickupRow>(
      `
        SELECT
          created_at,
          txlogistic_id,
          branch_code,
          order_code,
          bill_code,
          status
        FROM pickup_requests
        WHERE created_at >= now() - ($1::int * interval '1 day')
        ORDER BY created_at DESC
        LIMIT $2
      `,
      limitParams,
    );

    console.info("\nPickups recentes");
    console.table(
      recentPickups.rows.map((row) => ({
        createdAt: formatDate(row.created_at),
        txlogisticId: row.txlogistic_id,
        branchCode: row.branch_code ?? "-",
        orderCode: row.order_code ?? "-",
        billCode: row.bill_code,
        status: row.status,
      })),
    );

    const errorSummary = await db.query<ErrorSummaryRow>(
      `
        SELECT
          source,
          count(*) AS errors,
          max(created_at) AS last_error_at
        FROM integration_errors
        WHERE created_at >= now() - ($1::int * interval '1 day')
        GROUP BY source
        ORDER BY errors DESC, source
      `,
      intervalParams,
    );

    console.info("\nErros por origem");
    console.table(
      errorSummary.rows.map((row) => ({
        source: row.source,
        errors: asNumber(row.errors),
        lastErrorAt: formatDate(row.last_error_at),
      })),
    );

    const recentErrors = await db.query<RecentErrorRow>(
      `
        SELECT
          created_at,
          source,
          branch_code,
          order_code,
          txlogistic_id,
          message
        FROM integration_errors
        WHERE created_at >= now() - ($1::int * interval '1 day')
        ORDER BY created_at DESC
        LIMIT $2
      `,
      limitParams,
    );

    console.info("\nErros recentes");
    console.table(
      recentErrors.rows.map((row) => ({
        createdAt: formatDate(row.created_at),
        source: row.source,
        branchCode: row.branch_code ?? "-",
        orderCode: row.order_code ?? "-",
        txlogisticId: row.txlogistic_id ?? "-",
        message: shorten(row.message),
      })),
    );

    const issueSummary = await db.query<IssueSummaryRow>(
      `
        SELECT
          status,
          severity,
          issue_type,
          count(*) AS issues,
          max(last_seen_at) AS last_seen_at
        FROM operational_issues
        WHERE last_seen_at >= now() - ($1::int * interval '1 day')
        GROUP BY status, severity, issue_type
        ORDER BY status, severity DESC, issues DESC
      `,
      intervalParams,
    );

    console.info("\nPendencias operacionais por status");
    console.table(
      issueSummary.rows.map((row) => ({
        status: row.status,
        severity: row.severity,
        issueType: row.issue_type,
        issues: asNumber(row.issues),
        lastSeenAt: formatDate(row.last_seen_at),
      })),
    );

    const openIssues = await db.query<RecentIssueRow>(
      `
        SELECT
          last_seen_at,
          severity,
          issue_type,
          reason,
          branch_code,
          order_code,
          txlogistic_id
        FROM operational_issues
        WHERE status = 'open'
        ORDER BY last_seen_at DESC
        LIMIT $1
      `,
      [options.limit],
    );

    console.info("\nPendencias abertas");
    console.table(
      openIssues.rows.map((row) => ({
        lastSeenAt: formatDate(row.last_seen_at),
        severity: row.severity,
        issueType: row.issue_type,
        reason: shorten(row.reason, 60),
        branchCode: row.branch_code,
        orderCode: row.order_code,
        txlogisticId: row.txlogistic_id ?? "-",
      })),
    );

    const reprocessSummary = await db.query<ReprocessSummaryRow>(
      `
        SELECT
          status,
          count(*) AS requests,
          max(created_at) AS last_created_at
        FROM reprocess_requests
        WHERE created_at >= now() - ($1::int * interval '1 day')
        GROUP BY status
        ORDER BY status
      `,
      intervalParams,
    );

    console.info("\nReprocessamentos por status");
    console.table(
      reprocessSummary.rows.map((row) => ({
        status: row.status,
        requests: asNumber(row.requests),
        lastCreatedAt: formatDate(row.last_created_at),
      })),
    );

    const pendingReprocess = await db.query<PendingReprocessRow>(
      `
        SELECT
          id,
          created_at,
          branch_code,
          order_code,
          txlogistic_id,
          status,
          jt_send_enabled,
          force_send,
          reason
        FROM reprocess_requests
        WHERE status IN ('pending', 'running')
        ORDER BY created_at
        LIMIT $1
      `,
      [options.limit],
    );

    console.info("\nFila de reprocessamento ativa");
    console.table(
      pendingReprocess.rows.map((row) => ({
        id: row.id,
        createdAt: formatDate(row.created_at),
        branchCode: row.branch_code,
        orderCode: row.order_code,
        txlogisticId: row.txlogistic_id ?? "-",
        status: row.status,
        send: row.jt_send_enabled,
        forceSend: row.force_send,
        reason: shorten(row.reason, 60),
      })),
    );
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
