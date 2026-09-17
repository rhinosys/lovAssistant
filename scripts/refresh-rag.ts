import { startRagRefresh } from "../src/server/rag/maintenance/refresh";
try { process.loadEnvFile(); } catch { /* Environment may be supplied by systemd. */ }
startRagRefresh().then(({ completion }) => completion).catch(error => {
  console.error("RAG refresh failed:", error);
  process.exitCode = 1;
});
