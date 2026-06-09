import { loadPostgresSettings } from "../../config/settings.js";
import { sanitizeForLogging } from "../../infrastructure/logging/sanitizer.js";
import { createPostgresDatabase } from "../../infrastructure/persistence/postgres/postgres-database.js";

interface InspectOrderOptions {
  branchCode: number;
  orderCode: number;
}

function getArgValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseRequiredNumber(
  value: string | undefined,
  envName: string,
  label: string,
): number {
  const parsed = Number(value ?? process.env[envName]);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Informe ${label} com --${label}=N ou ${envName}=N.`);
  }

  return parsed;
}

function parseOptions(argv: string[]): InspectOrderOptions {
  return {
    branchCode: parseRequiredNumber(
      getArgValue(argv, "branch"),
      "ORDER_BRANCH_CODE",
      "branch",
    ),
    orderCode: parseRequiredNumber(
      getArgValue(argv, "order"),
      "ORDER_CODE",
      "order",
    ),
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const db = createPostgresDatabase(loadPostgresSettings());

  try {
    const params = [options.branchCode, options.orderCode];
    const [
      orders,
      pickups,
      issues,
      errors,
      events,
      overrides,
      reprocessRequests,
      reprocessAttempts,
    ] = await Promise.all([
      db.query(
        `
          SELECT *
          FROM orders
          WHERE branch_code = $1 AND order_code = $2
          LIMIT 1
        `,
        params,
      ),
      db.query(
        `
          SELECT *
          FROM pickup_requests
          WHERE branch_code = $1 AND order_code = $2
          ORDER BY created_at DESC
        `,
        params,
      ),
      db.query(
        `
          SELECT *
          FROM operational_issues
          WHERE branch_code = $1 AND order_code = $2
          ORDER BY status, last_seen_at DESC
        `,
        params,
      ),
      db.query(
        `
          SELECT *
          FROM integration_errors
          WHERE branch_code = $1 AND order_code = $2
          ORDER BY created_at DESC
          LIMIT 20
        `,
        params,
      ),
      db.query(
        `
          SELECT *
          FROM order_processing_events
          WHERE branch_code = $1 AND order_code = $2
          ORDER BY event_time DESC
          LIMIT 50
        `,
        params,
      ),
      db.query(
        `
          SELECT *
          FROM order_overrides
          WHERE branch_code = $1 AND order_code = $2
          ORDER BY created_at DESC
          LIMIT 10
        `,
        params,
      ),
      db.query(
        `
          SELECT *
          FROM reprocess_requests
          WHERE branch_code = $1 AND order_code = $2
          ORDER BY created_at DESC
          LIMIT 20
        `,
        params,
      ),
      db.query(
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

    const report = sanitizeForLogging({
      order: orders.rows[0] ?? null,
      pickups: pickups.rows,
      operationalIssues: issues.rows,
      integrationErrors: errors.rows,
      processingEvents: events.rows,
      orderOverrides: overrides.rows,
      reprocessRequests: reprocessRequests.rows,
      reprocessAttempts: reprocessAttempts.rows,
    });

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
