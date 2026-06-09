import { createContainer } from "./container.js";

const container = createContainer();

container.logger.info("Projeto de integracao inicializado.", {
  dailySyncCron: container.settings.dailySyncCron,
  persistenceAdapter: container.settings.persistenceAdapter,
});
