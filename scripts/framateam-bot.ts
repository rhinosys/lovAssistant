import { resetConfigCache } from "../src/server/config";
import { closeDbPool } from "../src/server/persistence/db";
import { logger } from "../src/server/observability/logger";
import { answerQuestion } from "../src/server/chat/answer";
import { FramateamBot } from "../src/server/framateam/bot";
import { runFramateamSync } from "../src/server/framateam/sync";

// Load local environment variables (systemd provides them in production).
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
    resetConfigCache();
  }
} catch {
  // Optional
}

// Long-running service: websocket listener + scheduled sync. Configuration comes from the
// admin area (or FRAMATEAM_* variables) and is reloaded on change without restart.
const bot = new FramateamBot({
  answer: ({ question, userHistory }) => answerQuestion({ question, userHistory }),
  runSync: () => runFramateamSync(),
});

let stopping = false;
const shutdown = async (signal: string) => {
  if (stopping) return;
  stopping = true;
  logger.info("Framateam bot stopping", { signal });
  await bot.stop();
  await bot.idle();
  await closeDbPool();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

bot.start().then(
  () => logger.info("Framateam bot started"),
  (error) => {
    logger.error("Framateam bot failed to start", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
);
