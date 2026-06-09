import { loadPostgresSettings } from "../../config/settings.js";
import { createPostgresDatabase } from "../../infrastructure/persistence/postgres/postgres-database.js";
import { PostgresMigrationRunner } from "../../infrastructure/persistence/postgres/migration-runner.js";

async function main(): Promise<void> {
  const postgresSettings = loadPostgresSettings();
  const db = createPostgresDatabase(postgresSettings);
  const runner = new PostgresMigrationRunner(
    db,
    postgresSettings.migrationsDirectory,
  );

  try {
    await runner.run();
    console.info("Migrations Postgres aplicadas com sucesso.");
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
