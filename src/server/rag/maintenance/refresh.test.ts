import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getRagStatus, RefreshBusyError, startRagRefresh } from "./refresh";
let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "lova-rag-test-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  await fs.mkdir(path.join(dir, "wiki-old"));
});
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(dir, { recursive: true, force: true }); });
const write = (name: string, value: unknown) => fs.writeFile(path.join(dir, "wiki-old", name), JSON.stringify(value));
describe("RAG maintenance", () => {
  it("reports an absent index without claiming zero indexed documents are ready", async () => {
    expect(await getRagStatus()).toMatchObject({ phase: "empty", documents: 0, chunks: 0, running: false });
  });
  it("counts distinct indexed documents rather than chunks or crawled pages", async () => {
    await write("vector-index.json", { createdAt: "2026-09-18", chunks: [{ documentId: "a" }, { documentId: "a" }, { documentId: "b" }] });
    expect(await getRagStatus()).toMatchObject({ phase: "ready", documents: 2, chunks: 3 });
  });
  it("rejects concurrent refreshes using the shared process lock", async () => {
    await write("refresh.lock", { pid: process.pid });
    await expect(startRagRefresh()).rejects.toBeInstanceOf(RefreshBusyError);
  });
  it("reports interruption when a running job no longer owns a lock", async () => {
    await write("refresh-status.json", { phase: "indexing", startedAt: "2026-09-18" });
    expect(await getRagStatus()).toMatchObject({ phase: "error", running: false });
  });
  it("keeps the old index and releases the lock when the crawl fails", async () => {
    await write("vector-index.json", { chunks: [{ documentId: "old" }] });
    const { completion } = await startRagRefresh();
    await expect(completion).rejects.toThrow();
    expect(await getRagStatus()).toMatchObject({ phase: "error", documents: 1, running: false });
  });
});

it("publishes a successful refresh and exposes its actual indexed counts", async () => {
  await fs.mkdir(path.join(dir, "scripts"));
  await fs.symlink(path.resolve(import.meta.dirname, "../../../..", "node_modules"), path.join(dir, "node_modules"));
  await fs.writeFile(path.join(dir, "scripts/crawl-old-wiki.ts"), `
    const fs = require('node:fs'); const path = require('node:path');
    const dir = process.env.RAG_DATA_DIR;
    fs.mkdirSync(path.join(dir, 'raw')); fs.mkdirSync(path.join(dir, 'markdown'));
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({totalDocuments: 2}));
  `);
  await fs.writeFile(path.join(dir, "scripts/index-rag.ts"), `
    const fs = require('node:fs'); const path = require('node:path');
    fs.writeFileSync(path.join(process.env.RAG_DATA_DIR, 'vector-index.json'), JSON.stringify({createdAt:'2026-09-18',chunks:[{documentId:'a'},{documentId:'b'}]}));
  `);
  const { completion } = await startRagRefresh();
  await expect(startRagRefresh()).rejects.toBeInstanceOf(RefreshBusyError);
  await completion;
  expect(await getRagStatus()).toMatchObject({ phase: "ready", documents: 2, chunks: 2, running: false });
});
