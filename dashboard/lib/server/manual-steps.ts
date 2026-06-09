import { spawn } from "node:child_process";
import { dirname, sep } from "node:path";

export interface ManualStep {
  id: string;
  title: string;
  description: string;
  commandLabel: string;
  tone: "default" | "success" | "warning" | "danger";
}

interface ManualStepDefinition extends ManualStep {
  args: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface ManualStepRunResult {
  step: ManualStep;
  commandLabel: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  ok: boolean;
}

const OUTPUT_LIMIT = 24000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

const manualStepDefinitions: ManualStepDefinition[] = [
  {
    id: "db-migrate",
    title: "Aplicar migrations",
    description: "Atualiza o schema Postgres antes de rodar novos lotes.",
    commandLabel: "npm run db:migrate",
    args: ["run", "db:migrate"],
    tone: "default",
  },
  {
    id: "db-inspect",
    title: "Conferir banco",
    description: "Mostra o resumo operacional recente do Postgres.",
    commandLabel: "npm run db:inspect -- --days=1 --limit=20",
    args: ["run", "db:inspect", "--", "--days=1", "--limit=20"],
    tone: "default",
  },
  {
    id: "totvs-smoke",
    title: "Buscar pedidos TOTVS",
    description: "Consulta pedidos JET/Attended e salva a amostra usada nos dry-runs.",
    commandLabel:
      "VIRTUAL_AGE_ORDER_STATUS_LIST=Attended SMOKE_SHIPPING_COMPANY_CODE=88442 SMOKE_OUTPUT_FILE=docs/attended-jet-orders.json npm run smoke:totvs-orders",
    args: ["run", "smoke:totvs-orders"],
    env: {
      VIRTUAL_AGE_ORDER_STATUS_LIST: "Attended",
      SMOKE_SHIPPING_COMPANY_CODE: "88442",
      SMOKE_OUTPUT_FILE: "docs/attended-jet-orders.json",
    },
    timeoutMs: 12 * 60 * 1000,
    tone: "success",
  },
  {
    id: "jt-dry-run",
    title: "Gerar payload J&T",
    description: "Monta o dry-run do primeiro pedido salvo sem enviar para a J&T.",
    commandLabel:
      "DRY_RUN_INPUT_FILE=docs/attended-jet-orders.json DRY_RUN_ORDER_INDEX=0 DRY_RUN_OUTPUT_FILE=docs/jt-order-dry-run.json npm run dry-run:jt-order",
    args: ["run", "dry-run:jt-order"],
    env: {
      DRY_RUN_INPUT_FILE: "docs/attended-jet-orders.json",
      DRY_RUN_ORDER_INDEX: "0",
      DRY_RUN_OUTPUT_FILE: "docs/jt-order-dry-run.json",
      JT_SEND_ENABLED: "false",
    },
    timeoutMs: 8 * 60 * 1000,
    tone: "success",
  },
  {
    id: "sync-dry-run",
    title: "Rodar lote em dry-run",
    description: "Executa o fluxo completo do dia, gravando auditoria sem chamar addOrder.",
    commandLabel: "JT_SEND_ENABLED=false npm run sync:daily",
    args: ["run", "sync:daily"],
    env: {
      JT_SEND_ENABLED: "false",
    },
    timeoutMs: 15 * 60 * 1000,
    tone: "warning",
  },
  {
    id: "export-latest",
    title: "Exportar ultimo lote",
    description: "Gera o CSV operacional do lote mais recente para conferencia.",
    commandLabel: "npm run monitor:export-orders",
    args: ["run", "monitor:export-orders"],
    tone: "default",
  },
  {
    id: "reprocess-dry-run",
    title: "Rodar fila de reprocessamento",
    description: "Processa a fila pendente em dry-run, sem envio real.",
    commandLabel: "JT_SEND_ENABLED=false npm run reprocess:run -- --limit=5",
    args: ["run", "reprocess:run", "--", "--limit=5"],
    env: {
      JT_SEND_ENABLED: "false",
      REPROCESS_JT_SEND_ENABLED: "false",
    },
    timeoutMs: 12 * 60 * 1000,
    tone: "warning",
  },
];

function projectRoot(): string {
  const current = process.cwd();
  return current.endsWith(`${sep}dashboard`) ? dirname(current) : current;
}

function publicStep(step: ManualStepDefinition): ManualStep {
  return {
    id: step.id,
    title: step.title,
    description: step.description,
    commandLabel: step.commandLabel,
    tone: step.tone,
  };
}

function truncateOutput(value: string): string {
  if (value.length <= OUTPUT_LIMIT) {
    return value;
  }

  return `${value.slice(0, OUTPUT_LIMIT)}\n\n[saida truncada em ${OUTPUT_LIMIT} caracteres]`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sensitiveValues(): string[] {
  const sensitiveKeyPattern =
    /(PASSWORD|SECRET|PRIVATE|TOKEN|KEY|ACCOUNT|CUSTOMER|DATABASE_URL|POSTGRES_URL|AUTHORIZATION|DIGEST|SIGNATURE|TAX|MOBILE|PHONE)/i;

  return Object.entries(process.env)
    .flatMap(([key, value]) =>
      sensitiveKeyPattern.test(key) && value && value.length > 2 ? [value] : [],
    )
    .sort((a, b) => b.length - a.length);
}

function maskOutput(value: string): string {
  let current = value
    .replace(/postgres:\/\/[^\s"'@]+:[^\s"'@]+@/g, "postgres://[REDACTED]@")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");

  for (const secret of sensitiveValues()) {
    current = current.replace(new RegExp(escapeRegExp(secret), "g"), "[REDACTED]");
  }

  return truncateOutput(current);
}

export function listManualSteps(): ManualStep[] {
  return manualStepDefinitions.map(publicStep);
}

export async function runManualStep(stepId: string): Promise<ManualStepRunResult> {
  const step = manualStepDefinitions.find((item) => item.id === stepId);

  if (!step) {
    throw new Error("Passo operacional desconhecido.");
  }

  const startedAt = Date.now();
  const env = {
    ...process.env,
    FORCE_COLOR: "0",
    NO_COLOR: "1",
    ...(step.env ?? {}),
  };

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const child = spawn("npm", step.args, {
      cwd: projectRoot(),
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 3000).unref();
    }, step.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startedAt;

      resolve({
        step: publicStep(step),
        commandLabel: step.commandLabel,
        exitCode,
        durationMs,
        timedOut,
        stdout: maskOutput(stdout),
        stderr: maskOutput(stderr),
        ok: exitCode === 0 && !timedOut,
      });
    });
  });
}
