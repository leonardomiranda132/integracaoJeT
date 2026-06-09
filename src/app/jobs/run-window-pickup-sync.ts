import { createContainer } from "../container.js";
import type { TimeWindow } from "../../shared/types.js";
import { IntegrationError } from "../../domain/errors/integration-error.js";

function normalizeDateInput(value: string, edge: "start" | "end"): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T${edge === "start" ? "00:00:00" : "23:59:59"}-03:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/.test(value)) {
    return value;
  }

  throw new IntegrationError("Data de janela invalida para sync customizado.", {
    value,
    expected:
      "Use YYYY-MM-DD ou ISO com timezone, por exemplo 2026-05-04T00:00:00-03:00.",
  });
}

function loadWindowFromEnv(): TimeWindow {
  const startDate = process.env.SYNC_START_DATE;
  const endDate = process.env.SYNC_END_DATE;

  if (!startDate || !endDate) {
    throw new IntegrationError(
      "SYNC_START_DATE e SYNC_END_DATE sao obrigatorios para sync:window.",
    );
  }

  return {
    startDate: normalizeDateInput(startDate, "start"),
    endDate: normalizeDateInput(endDate, "end"),
  };
}

async function main(): Promise<void> {
  const container = createContainer();
  const window = loadWindowFromEnv();

  container.logger.info("Iniciando rotina customizada de sincronismo.", {
    windowStart: window.startDate,
    windowEnd: window.endDate,
    jtSendEnabled: container.settings.operational.jtSendEnabled,
    dailySendLimit: container.settings.operational.dailySendLimit,
    orderStatuses: container.settings.totvs.orderStatusList,
    shippingCompanyCode: container.settings.totvs.shippingCompanyCode,
  });

  await container.useCases.syncOrdersUseCase.execute(window);

  container.logger.info("Rotina customizada finalizada.", {
    windowStart: window.startDate,
    windowEnd: window.endDate,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
