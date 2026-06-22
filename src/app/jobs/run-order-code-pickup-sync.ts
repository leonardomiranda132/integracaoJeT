import { createContainer } from "../container.js";
import { buildDailyWindow } from "../scheduler/daily-window.js";

function getArgValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseOrderCodeList(value: string | undefined): number[] {
  if (!value) {
    return [];
  }

  const orderCodes = value
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);

  return [...new Set(orderCodes)].sort((left, right) => left - right);
}

function loadOrderCodeList(argv: string[]): number[] {
  return parseOrderCodeList(
    getArgValue(argv, "orders") ??
      getArgValue(argv, "order-codes") ??
      process.env.SYNC_ORDER_CODES ??
      process.env.ORDER_CODE_LIST,
  );
}

async function main(): Promise<void> {
  const orderCodeList = loadOrderCodeList(process.argv.slice(2));

  if (orderCodeList.length === 0) {
    throw new Error(
      "Informe os pedidos com --orders=507713,507788 ou SYNC_ORDER_CODES=507713,507788.",
    );
  }

  const container = createContainer();
  const window = await buildDailyWindow(container.settings.timezone);

  container.logger.info("Iniciando sincronismo por lista explicita de pedidos.", {
    windowStart: window.startDate,
    windowEnd: window.endDate,
    orderCodeList,
    jtSendEnabled: container.settings.operational.jtSendEnabled,
    dailySendLimit: container.settings.operational.dailySendLimit,
  });

  await container.useCases.syncOrdersUseCase.execute(window, {
    orderCodeList,
    useChangeFilter: false,
  });

  container.logger.info("Sincronismo por lista explicita de pedidos finalizado.", {
    windowStart: window.startDate,
    windowEnd: window.endDate,
    orderCodeList,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
