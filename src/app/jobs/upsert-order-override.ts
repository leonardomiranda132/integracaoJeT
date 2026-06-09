import { randomUUID } from "node:crypto";
import { loadPostgresSettings } from "../../config/settings.js";
import { sanitizeForLogging } from "../../infrastructure/logging/sanitizer.js";
import { createPostgresDatabase } from "../../infrastructure/persistence/postgres/postgres-database.js";
import { toJsonb } from "../../infrastructure/persistence/postgres/json.js";

interface OverrideOptions {
  branchCode: number;
  orderCode: number;
  patch: Record<string, unknown>;
  reason: string;
  createdBy: string;
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

function parsePatch(value: string | undefined): Record<string, unknown> {
  if (!value) {
    throw new Error("Informe o patch com --patch='{\"campo\":\"valor\"}'.");
  }

  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("O patch precisa ser um objeto JSON.");
  }

  return parsed as Record<string, unknown>;
}

function parseOptions(argv: string[]): OverrideOptions {
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
    patch: parsePatch(getArgValue(argv, "patch") ?? process.env.ORDER_OVERRIDE_PATCH),
    reason:
      getArgValue(argv, "reason") ??
      process.env.ORDER_OVERRIDE_REASON ??
      "Correcao operacional manual.",
    createdBy:
      getArgValue(argv, "created-by") ??
      process.env.ORDER_OVERRIDE_CREATED_BY ??
      "operator",
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const db = createPostgresDatabase(loadPostgresSettings());
  const id = randomUUID();

  try {
    await db.query("BEGIN");
    await db.query(
      `
        UPDATE order_overrides
        SET
          status = 'disabled',
          disabled_at = now(),
          updated_at = now()
        WHERE branch_code = $1
          AND order_code = $2
          AND status = 'active'
      `,
      [options.branchCode, options.orderCode],
    );
    await db.query(
      `
        INSERT INTO order_overrides (
          id,
          branch_code,
          order_code,
          patch,
          reason,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        id,
        options.branchCode,
        options.orderCode,
        toJsonb(options.patch),
        options.reason,
        options.createdBy,
      ],
    );
    await db.query("COMMIT");

    console.log(
      JSON.stringify(
        sanitizeForLogging({
          id,
          branchCode: options.branchCode,
          orderCode: options.orderCode,
          status: "active",
          patch: options.patch,
          reason: options.reason,
          createdBy: options.createdBy,
        }),
        null,
        2,
      ),
    );
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
