import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { logger } from "../../observability/logger";

const base = () => path.join(process.cwd(), "wiki-old");
const statePath = () => path.join(base(), "refresh-status.json");
const lockPath = () => path.join(base(), "refresh.lock");
type Job = { phase: "crawling" | "indexing" | "ready" | "error"; startedAt: string; finishedAt?: string; error?: string };
export class RefreshBusyError extends Error {}

const alive = (pid: number) => {
  try { process.kill(pid, 0); return true; } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
};
const readJson = async (file: string) => {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
};
const writeState = async (job: Job) => {
  const tmp = `${statePath()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(job));
  await fs.rename(tmp, statePath());
};

export const getRagStatus = async () => {
  const [index, job, lock] = await Promise.all([
    readJson(path.join(base(), "vector-index.json")), readJson(statePath()), readJson(lockPath()),
  ]);
  const running = !!lock && alive(lock.pid);
  const interrupted = job && ["crawling", "indexing"].includes(job.phase) && !running;
  const chunks = index?.chunks ?? [];
  return {
    phase: running ? (job?.phase === "indexing" ? "indexing" : "crawling") : interrupted ? "error" : job?.phase ?? (index ? "ready" : "empty"),
    running,
    documents: new Set(chunks.map((chunk: { documentId: string }) => chunk.documentId)).size,
    chunks: chunks.length,
    updatedAt: index?.createdAt ?? null,
    startedAt: job?.startedAt ?? null,
    error: interrupted ? "La mise à jour a été interrompue. Vous pouvez la relancer." : job?.error ?? null,
  };
};

// CLI and web use the same filesystem lock. PID ownership allows recovery after restart.
const acquireLock = async () => {
  await fs.mkdir(base(), { recursive: true });
  try {
    const lock = await fs.open(lockPath(), "wx", 0o600);
    await lock.writeFile(JSON.stringify({ pid: process.pid }));
    await lock.close();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    let owner;
    try { owner = await readJson(lockPath()); } catch { throw new RefreshBusyError(); }
    if (!owner || alive(owner.pid)) throw new RefreshBusyError();
    await fs.unlink(lockPath());
    return acquireLock();
  }
};

const runScript = (script: string, directory: string) => new Promise<void>((resolve, reject) => {
  // Absolute Node executable also works under systemd and sudo secure_path.
  const child = spawn(process.execPath, ["--import", "tsx", path.join(process.cwd(), "scripts", script)], {
    cwd: process.cwd(), env: { ...process.env, RAG_DATA_DIR: directory }, stdio: ["ignore", "inherit", "inherit"],
  });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 30 * 60_000);
  child.once("error", error => { clearTimeout(timeout); reject(error); });
  child.once("close", code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(`${script} exited with ${code}`)); });
});

export const startRagRefresh = async () => {
  await acquireLock();
  const startedAt = new Date().toISOString();
  try { await writeState({ phase: "crawling", startedAt }); }
  catch (error) { await fs.unlink(lockPath()); throw error; }
  // The native long-running Next.js service owns this work; no serverless deployment.
  const completion = (async () => {
    let staging: string | undefined;
    try {
      staging = await fs.mkdtemp(path.join(base(), ".refresh-"));
      logger.info("RAG refresh started");
      await runScript("crawl-old-wiki.ts", staging);
      const manifest = await readJson(path.join(staging, "manifest.json"));
      if (!manifest?.totalDocuments) throw new Error("Crawl returned no documents");
      await writeState({ phase: "indexing", startedAt });
      await runScript("index-rag.ts", staging);
      const index = await readJson(path.join(staging, "vector-index.json"));
      if (!index?.chunks?.length) throw new Error("Index contains no chunks");
      // Publish only after success. Atomic rename keeps existing chats on a complete index.
      for (const name of ["raw", "markdown"]) {
        await fs.cp(path.join(staging, name), path.join(base(), name), { recursive: true });
      }
      await fs.rename(path.join(staging, "manifest.json"), path.join(base(), "manifest.json"));
      await fs.rename(path.join(staging, "vector-index.json"), path.join(base(), "vector-index.json"));
      await writeState({ phase: "ready", startedAt, finishedAt: new Date().toISOString() });
      logger.info("RAG refresh completed", { documents: manifest.totalDocuments, chunks: index.chunks.length });
    } catch (error) {
      logger.error("RAG refresh failed", { error: String(error) });
      await writeState({ phase: "error", startedAt, finishedAt: new Date().toISOString(), error: "Échec de la mise à jour. L’index précédent est conservé. Consultez les journaux du service." });
      throw error;
    } finally {
      try { if (staging) await fs.rm(staging, { recursive: true, force: true }); }
      finally { await fs.unlink(lockPath()); }
    }
  })();
  return { completion };
};
