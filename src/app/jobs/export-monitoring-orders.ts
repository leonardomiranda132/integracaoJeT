import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadPostgresSettings } from "../../config/settings.js";
import { createPostgresDatabase } from "../../infrastructure/persistence/postgres/postgres-database.js";

interface ExportOptions {
  format: "csv" | "json";
  outputFile: string;
  syncRunId?: string;
}

interface LatestSyncRunRow {
  id: string;
  started_at: Date | string;
  finished_at: Date | string | null;
  window_start: Date | string;
  window_end: Date | string;
  pages_read: number;
  orders_read: number;
  pickups_created: number;
  errors: number;
}

interface ExportOrderRow {
  sync_run_id: string;
  event_time: Date | string;
  event_type: string;
  event_status: string;
  event_reason: string | null;
  branch_code: number;
  order_code: string;
  txlogistic_id: string | null;
  customer_name: string;
  shipping_company_code: number | null;
  shipping_company_name: string | null;
  status_order: string;
  invoice_number: string | null;
  invoice_money: string | null;
  total_amount_order: string | null;
  pickup_status: string | null;
  bill_code: string | null;
  open_issue_reason: string | null;
}

function getArgValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseFormat(value: string | undefined): "csv" | "json" {
  return value === "json" ? "json" : "csv";
}

function defaultOutputFile(format: "csv" | "json"): string {
  return `docs/operational-exports/orders-latest.${format}`;
}

function parseOptions(argv: string[]): ExportOptions {
  const format = parseFormat(getArgValue(argv, "format") ?? process.env.EXPORT_FORMAT);

  return {
    format,
    outputFile: resolve(
      process.cwd(),
      getArgValue(argv, "output") ??
        process.env.EXPORT_OUTPUT_FILE ??
        defaultOutputFile(format),
    ),
    syncRunId: getArgValue(argv, "sync-run-id") ?? process.env.EXPORT_SYNC_RUN_ID,
  };
}

function formatDate(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const db = createPostgresDatabase(loadPostgresSettings());

  try {
    const syncRun = options.syncRunId
      ? (
          await db.query<LatestSyncRunRow>(
            `
              SELECT
                id,
                started_at,
                finished_at,
                window_start,
                window_end,
                pages_read,
                orders_read,
                pickups_created,
                errors
              FROM sync_runs
              WHERE id = $1
              LIMIT 1
            `,
            [options.syncRunId],
          )
        ).rows[0]
      : (
          await db.query<LatestSyncRunRow>(
            `
              SELECT
                id,
                started_at,
                finished_at,
                window_start,
                window_end,
                pages_read,
                orders_read,
                pickups_created,
                errors
              FROM sync_runs
              WHERE status = 'succeeded'
              ORDER BY finished_at DESC
              LIMIT 1
            `,
          )
        ).rows[0];

    if (!syncRun) {
      throw new Error("Nenhum sync run encontrado para exportacao.");
    }

    const result = await db.query<ExportOrderRow>(
      `
        SELECT
          e.sync_run_id,
          e.event_time,
          e.event_type,
          e.status AS event_status,
          e.reason AS event_reason,
          e.branch_code,
          e.order_code,
          e.txlogistic_id,
          o.customer_name,
          o.shipping_company_code,
          o.shipping_company_name,
          o.status_order,
          o.invoice_number,
          o.invoice_money,
          o.total_amount_order,
          p.status AS pickup_status,
          p.bill_code,
          oi.reason AS open_issue_reason
        FROM order_processing_events e
        JOIN orders o
          ON o.branch_code = e.branch_code
         AND o.order_code = e.order_code
        LEFT JOIN pickup_requests p
          ON p.branch_code = e.branch_code
         AND p.order_code = e.order_code
        LEFT JOIN operational_issues oi
          ON oi.branch_code = e.branch_code
         AND oi.order_code = e.order_code
         AND oi.status = 'open'
        WHERE e.sync_run_id = $1
        ORDER BY e.branch_code, e.order_code, e.event_time
      `,
      [syncRun.id],
    );

    const rows = result.rows.map((row) => ({
      syncRunId: row.sync_run_id,
      eventTime: formatDate(row.event_time),
      eventType: row.event_type,
      eventStatus: row.event_status,
      eventReason: row.event_reason ?? "",
      branchCode: row.branch_code,
      orderCode: row.order_code,
      txlogisticId: row.txlogistic_id ?? "",
      customerName: row.customer_name,
      shippingCompanyCode: row.shipping_company_code ?? "",
      shippingCompanyName: row.shipping_company_name ?? "",
      statusOrder: row.status_order,
      invoiceNumber: row.invoice_number ?? "",
      invoiceMoney: row.invoice_money ?? "",
      totalAmountOrder: row.total_amount_order ?? "",
      pickupStatus: row.pickup_status ?? "",
      billCode: row.bill_code ?? "",
      openIssueReason: row.open_issue_reason ?? "",
    }));

    const output = options.format === "json"
      ? JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            syncRun: {
              id: syncRun.id,
              startedAt: formatDate(syncRun.started_at),
              finishedAt: formatDate(syncRun.finished_at),
              windowStart: formatDate(syncRun.window_start),
              windowEnd: formatDate(syncRun.window_end),
              pagesRead: syncRun.pages_read,
              ordersRead: syncRun.orders_read,
              pickupsCreated: syncRun.pickups_created,
              errors: syncRun.errors,
            },
            orders: rows,
          },
          null,
          2,
        )
      : toCsv(rows);

    await mkdir(dirname(options.outputFile), { recursive: true });
    await writeFile(options.outputFile, output, "utf8");

    console.log(
      JSON.stringify(
        {
          outputFile: options.outputFile,
          format: options.format,
          syncRunId: syncRun.id,
          rows: rows.length,
          note: "Arquivo sem CPF, telefone ou endereco.",
        },
        null,
        2,
      ),
    );
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
