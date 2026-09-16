import { runMigrations } from "../src/server/persistence/migrate";
import { resetConfigCache } from "../src/server/config";
import { closeDbPool } from "../src/server/persistence/db";

// Load local environment variables
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
    resetConfigCache();
  }
} catch {
  // Optional
}

async function run() {
  console.log("=== DATABASE MIGRATIONS ===");
  const applied = await runMigrations();
  if (applied.length === 0) {
    console.log("Aucune nouvelle migration à appliquer.");
  } else {
    console.log(`✓ ${applied.length} migration(s) appliquée(s) :`);
    for (const name of applied) {
      console.log(`  - ${name}`);
    }
  }
  await closeDbPool();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
