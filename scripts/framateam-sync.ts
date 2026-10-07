import { resetConfigCache } from "../src/server/config";
import { closeDbPool } from "../src/server/persistence/db";
import { runFramateamSync } from "../src/server/framateam/sync";

// Load local environment variables
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
    resetConfigCache();
  }
} catch {
  // Optional
}

const HELP = `Usage : npm run framateam:sync [-- --channel <id>...]

Synchronise les canaux publics Framateam activés pour l'indexation (interface admin,
ou FRAMATEAM_INDEX_CHANNELS en mode .env) : chargement initial puis incrémental.
Une seule synchronisation peut tourner à la fois (verrou PostgreSQL).`;

async function run() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }
  const channelIds = args.flatMap((arg, i) => (arg === "--channel" && args[i + 1] ? [args[i + 1]] : []));
  console.log("=== SYNCHRONISATION FRAMATEAM ===");
  const report = await runFramateamSync(channelIds.length ? { channelIds } : {});
  for (const channel of report.channels) {
    const status = channel.error ? `ERREUR : ${channel.error}` : "ok";
    console.log(`- ~${channel.name} : ${channel.postsRead} message(s) lu(s), ${channel.threadsIndexed} fil(s) indexé(s), ${channel.threadsRemoved} retiré(s) — ${status}`);
  }
  if (!report.channels.length) console.log("Aucun canal activé pour l'indexation.");
  if (report.purgedChannels) console.log(`${report.purgedChannels} canal(aux) désactivé(s) purgé(s).`);
  if (report.channels.some((c) => c.error)) process.exitCode = 1;
}

run()
  .catch((err) => {
    console.error("Synchronisation Framateam échouée :", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDbPool());
