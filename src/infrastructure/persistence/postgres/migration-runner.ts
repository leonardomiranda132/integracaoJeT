import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { IntegrationError } from "../../../domain/errors/integration-error.js";
import type { PostgresDatabase } from "./postgres-database.js";

interface MigrationRow {
  version: string;
}

export class PostgresMigrationRunner {
  constructor(
    private readonly db: PostgresDatabase,
    private readonly migrationsDirectory: string,
  ) {}

  private async ensureMigrationsTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        name text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async run(): Promise<void> {
    await this.ensureMigrationsTable();

    let fileNames: string[];
    try {
      fileNames = (await readdir(this.migrationsDirectory))
        .filter((fileName) => fileName.endsWith(".sql"))
        .sort();
    } catch (error) {
      throw new IntegrationError("Falha ao ler diretorio de migrations.", {
        migrationsDirectory: this.migrationsDirectory,
        error,
      });
    }

    const appliedRows = await this.db.query<MigrationRow>(
      "SELECT version FROM schema_migrations",
    );
    const applied = new Set(appliedRows.rows.map((row) => row.version));

    for (const fileName of fileNames) {
      const version = basename(fileName, ".sql");

      if (applied.has(version)) {
        continue;
      }

      const filePath = join(this.migrationsDirectory, fileName);
      const sql = await readFile(filePath, "utf8");

      try {
        await this.db.query("BEGIN");
        await this.db.query(sql);
        await this.db.query(
          "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
          [version, fileName],
        );
        await this.db.query("COMMIT");
      } catch (error) {
        await this.db.query("ROLLBACK");
        throw new IntegrationError("Falha ao aplicar migration Postgres.", {
          migration: fileName,
          error,
        });
      }
    }
  }
}
