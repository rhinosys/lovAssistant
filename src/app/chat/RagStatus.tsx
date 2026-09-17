"use client";
import { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { apiUrl } from "@/lib/api-url";

type Status = { phase: string; running: boolean; documents: number; chunks: number; updatedAt: string | null; error: string | null };
const labels: Record<string, string> = { ready: "À jour", empty: "À initialiser", crawling: "Collecte du wiki…", indexing: "Indexation…", error: "Mise à jour en échec" };

export function RagStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(apiUrl("/api/rag"), { cache: "no-store" });
    if (!response.ok) throw new Error("Statut RAG indisponible.");
    const data = await response.json();
    setStatus(data);
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { await load(); } catch { if (!stopped) setError("Statut RAG indisponible. Nouvelle tentative automatique…"); }
      if (!stopped) timer = setTimeout(poll, 4000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [load]);
  const refresh = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(apiUrl("/api/rag/refresh"), { method: "POST", redirect: "error" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Connexion administrateur requise pour cette action.");
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error && cause.message !== "Failed to fetch" ? cause.message : "Mise à jour non lancée. Vérifiez votre connexion et vos droits YunoHost.");
    } finally { setPending(false); }
  };
  const busy = pending || status?.running;
  return (
    <section aria-label="Base documentaire RAG" className="mx-3 my-2 rounded-xl border border-slate-700/70 bg-slate-950/70 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-200"><Database className="h-4 w-4 text-emerald-400" />Base documentaire</div>
      <div role="status" aria-live="polite" className="mt-2 text-xs text-emerald-300">{status ? labels[status.phase] || status.phase : "Chargement…"}</div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{status?.documents ?? "—"}<span className="ml-2 text-xs font-normal text-slate-400">documents indexés</span></p>
      <p className="mt-1 text-xs text-slate-400">{status?.chunks ?? "—"} fragments · Wiki historique</p>
      <p className="mt-2 text-xs text-slate-400">Dernier index : {status?.updatedAt ? new Date(status.updatedAt).toLocaleString("fr-FR") : "aucun"}</p>
      {(error || status?.error) && <p role="alert" className="mt-2 text-xs text-amber-300">{error || status?.error}</p>}
      <button type="button" onClick={refresh} disabled={!!busy || !status} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/50 px-2 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-900/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:cursor-wait disabled:opacity-50">
        <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />{busy ? "Mise à jour en cours…" : "Mettre à jour le RAG"}
      </button>
    </section>
  );
}
