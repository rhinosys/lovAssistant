import fs from "fs";
import path from "path";
import { getDbPool } from "./db";
import { logger } from "../observability/logger";

export async function runMigrations(): Promise<string[]> {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedResult = await client.query<{ name: string }>(
      "SELECT name FROM _schema_migrations ORDER BY id ASC"
    );
    const appliedSet = new Set(appliedResult.rows.map((r) => r.name));

    const migrationsDir = path.join(process.cwd(), "src", "server", "persistence", "migrations");
    if (!fs.existsSync(migrationsDir)) {
      logger.warn("Migrations directory not found", { path: migrationsDir });
      return [];
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const newlyApplied: string[] = [];

    for (const file of files) {
      if (!appliedSet.has(file)) {
        logger.info(`Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query(
            "INSERT INTO _schema_migrations (name) VALUES ($1)",
            [file]
          );
          await client.query("COMMIT");
          newlyApplied.push(file);
          logger.info(`Successfully applied migration: ${file}`);
        } catch (err) {
          await client.query("ROLLBACK");
          logger.error(`Failed to apply migration ${file}`, { error: String(err) });
          throw err;
        }
      }
    }

    return newlyApplied;
  } finally {
    client.release();
  }
}
