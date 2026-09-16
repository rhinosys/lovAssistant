import pg from "pg";
import { getConfig } from "../config";
import { logger } from "../observability/logger";

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

export function getDbPool(): pg.Pool {
  if (!poolInstance) {
    const config = getConfig();
    poolInstance = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on("error", (err) => {
      logger.error("Unexpected error on idle PostgreSQL client", { error: err.message });
    });
  }
  return poolInstance;
}

export async function checkDbHealth(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
  // Check if test in-memory mode is active
  const { isForceInMemory } = await import("./index");
  if (isForceInMemory()) {
    return { healthy: true, latencyMs: 1 };
  }

  const start = Date.now();
  try {
    const pool = getDbPool();
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      const latencyMs = Date.now() - start;
      return { healthy: true, latencyMs };
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : "Unknown database error";
    return { healthy: false, latencyMs, error: message };
  }
}

export async function closeDbPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
