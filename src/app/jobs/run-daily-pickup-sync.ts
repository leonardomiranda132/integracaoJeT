import { createContainer } from "../container.js";
import { buildDailyWindow } from "../scheduler/daily-window.js";

async function main(): Promise<void> {
  const container = createContainer();
  const window = await buildDailyWindow(container.settings.timezone);

  container.logger.info("Iniciando rotina diaria de sincronismo.", {
    cron: container.settings.dailySyncCron,
    windowStart: window.startDate,
    windowEnd: window.endDate,
  });

  await container.useCases.syncOrdersUseCase.execute(window);

  container.logger.info("Rotina diaria finalizada.", {
    windowStart: window.startDate,
    windowEnd: window.endDate,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
