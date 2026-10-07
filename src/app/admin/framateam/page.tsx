"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, MessagesSquare, PlugZap, RefreshCw, Save, ShieldOff, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/api-url";

type Settings = {
  source: "database" | "env" | "none";
  baseUrl: string;
  teamName: string;
  loginId: string;
  passwordConfigured: boolean;
  passwordError: string | null;
  triggerKeyword: string;
  acceptMentions: boolean;
  syncIntervalMin: number;
};

type Channel = {
  channelId: string;
  name: string;
  displayName: string;
  indexEnabled: boolean;
  listenEnabled: boolean;
  initialDone: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  postsRead: number;
  lastRunPosts: number;
  threads: number;
};

type SyncState = { running: boolean; startedAt: string | null; finishedAt: string | null; error: string | null };
type Notice = { kind: "ok" | "error"; text: string } | null;

const sourceLabels: Record<Settings["source"], string> = {
  database: "configuration : interface admin",
  env: "configuration : .env",
  none: "non configuré",
};

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(apiUrl(path), {
    cache: "no-store",
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `Erreur ${response.status}`);
  return body as T;
};

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : "Erreur inattendue");
const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString("fr-FR") : "jamais");

const input = "w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-600 focus:outline-none";
const button = "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${button} border-emerald-700 bg-emerald-600/90 text-white hover:bg-emerald-600`;
const secondary = `${button} border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800`;
const danger = `${button} border-red-900 bg-red-950/40 text-red-200 hover:bg-red-900/40`;

function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p role={notice.kind === "error" ? "alert" : "status"} className={`mt-3 text-xs ${notice.kind === "error" ? "text-amber-300" : "text-emerald-300"}`}>
      {notice.text}
    </p>
  );
}

export default function FramateamAdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState({ baseUrl: "https://framateam.org", teamName: "", loginId: "", password: "", triggerKeyword: "!lov", acceptMentions: false, syncIntervalMin: 60 });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [sync, setSync] = useState<SyncState | null>(null);
  const [accountNotice, setAccountNotice] = useState<Notice>(null);
  const [channelNotice, setChannelNotice] = useState<Notice>(null);
  const [forgetNotice, setForgetNotice] = useState<Notice>(null);
  const [permalink, setPermalink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const applySettings = (s: Settings) => {
    setSettings(s);
    setForm({ baseUrl: s.baseUrl, teamName: s.teamName, loginId: s.loginId, password: "", triggerKeyword: s.triggerKeyword, acceptMentions: s.acceptMentions, syncIntervalMin: s.syncIntervalMin });
  };

  const loadChannels = useCallback(async (refresh: boolean) => {
    const data = await api<{ channels: Channel[] }>(`/api/admin/framateam/channels${refresh ? "?refresh=1" : ""}`);
    setChannels(data.channels);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ settings: Settings }>("/api/admin/framateam/settings");
        setAllowed(true);
        applySettings(data.settings);
        setSync((await api<{ sync: SyncState }>("/api/admin/framateam/sync")).sync);
        await loadChannels(data.settings.source !== "none").catch(async (cause) => {
          setChannelNotice({ kind: "error", text: `Liste Framateam indisponible : ${errorText(cause)}` });
          await loadChannels(false);
        });
      } catch {
        setAllowed(false);
      }
    })();
  }, [loadChannels]);

  // Poll while a sync runs, then refresh the per-channel status.
  useEffect(() => {
    if (!sync?.running) return;
    const timer = setInterval(async () => {
      try {
        const next = (await api<{ sync: SyncState }>("/api/admin/framateam/sync")).sync;
        setSync(next);
        // Counters are saved after each page: refresh them to show progress.
        await loadChannels(false);
        if (!next.running) {
          setChannelNotice(next.error ? { kind: "error", text: `Synchronisation en échec : ${next.error}` } : { kind: "ok", text: "Synchronisation terminée." });
        }
      } catch { /* Next tick retries. */ }
    }, 3000);
    return () => clearInterval(timer);
  }, [sync?.running, loadChannels]);

  const run = async (key: string, action: () => Promise<void>, setNotice: (notice: Notice) => void) => {
    setBusy(key);
    setNotice(null);
    try { await action(); } catch (cause) { setNotice({ kind: "error", text: errorText(cause) }); } finally { setBusy(null); }
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    void run("save", async () => {
      const data = await api<{ settings: Settings }>("/api/admin/framateam/settings", { method: "PUT", body: JSON.stringify(form) });
      applySettings(data.settings);
      setAccountNotice({ kind: "ok", text: "Réglages enregistrés. Le bot les prend en compte automatiquement." });
    }, setAccountNotice);
  };

  const test = () => run("test", async () => {
    const data = await api<{ username: string; team: string }>("/api/admin/framateam/test", { method: "POST" });
    setAccountNotice({ kind: "ok", text: `Connexion réussie : @${data.username} dans l'équipe « ${data.team} ».` });
    await loadChannels(true);
  }, setAccountNotice);

  const toggle = (channel: Channel, field: "indexEnabled" | "listenEnabled") => {
    const value = !channel[field];
    if (field === "indexEnabled" && !value && channel.threads > 0 && !window.confirm(`Désactiver l'indexation de ~${channel.name} supprime ses ${channel.threads} fil(s) de l'index. Continuer ?`)) return;
    void run(`${channel.channelId}:${field}`, async () => {
      await api(`/api/admin/framateam/channels/${channel.channelId}`, { method: "PATCH", body: JSON.stringify({ [field]: value }) });
      await loadChannels(false);
    }, setChannelNotice);
  };

  const startSync = () => run("sync", async () => {
    try {
      setSync((await api<{ sync: SyncState }>("/api/admin/framateam/sync", { method: "POST" })).sync);
      setChannelNotice({ kind: "ok", text: "Synchronisation lancée…" });
    } finally {
      // A sync started elsewhere (bot, CLI) is reported as running: follow its progress too.
      setSync((await api<{ sync: SyncState }>("/api/admin/framateam/sync")).sync);
    }
  }, setChannelNotice);

  const forgetChannel = (channel: Channel) => {
    if (!window.confirm(`Retirer tout le contenu de ~${channel.name} de l'index et désactiver son indexation ?`)) return;
    void run(`${channel.channelId}:forget`, async () => {
      const data = await api<{ removedChunks: number }>("/api/admin/framateam/forget", { method: "POST", body: JSON.stringify({ channel: channel.channelId }) });
      await loadChannels(false);
      setChannelNotice({ kind: "ok", text: `~${channel.name} retiré de l'index (${data.removedChunks} extrait(s) supprimé(s)).` });
    }, setChannelNotice);
  };

  const forgetPost = (event: FormEvent) => {
    event.preventDefault();
    if (!window.confirm("Retirer définitivement ce message de l'index ? Il ne sera plus jamais indexé.")) return;
    void run("forget", async () => {
      const { post } = await api<{ post: { postId: string; threadRemoved: boolean; threadRebuilt: boolean; rootPostId: string | null } }>(
        "/api/admin/framateam/forget", { method: "POST", body: JSON.stringify({ post: permalink }) }
      );
      setPermalink("");
      await loadChannels(false);
      const detail = !post.threadRemoved
        ? "Il n'était pas indexé ; il ne le sera jamais."
        : post.rootPostId === post.postId ? "Le fil complet a été retiré."
        : post.threadRebuilt ? "Le fil a été réindexé sans ce message." : "Le fil a été retiré en attendant sa réindexation sans ce message.";
      setForgetNotice({ kind: "ok", text: `Message ${post.postId} retiré. ${detail}` });
    }, setForgetNotice);
  };

  if (allowed === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-200">
        <div className="max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
          <ShieldOff className="mx-auto h-8 w-8 text-amber-400" />
          <h1 className="mt-3 text-lg font-semibold">Accès réservé aux administrateurs</h1>
          <p className="mt-2 text-sm text-slate-400">Cette page nécessite la permission YunoHost « admin » de l&apos;assistant.</p>
          <Link href="/chat" className={`${secondary} mt-4`}>Retour au chat</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      <header className="flex h-14 items-center gap-3 border-b border-slate-800/80 px-6">
        <Link href="/chat" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200" aria-label="Retour au chat">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <MessagesSquare className="h-5 w-5 text-emerald-400" />
        <h1 className="text-sm font-semibold text-slate-200">Administration · Framateam</h1>
      </header>

      {allowed === null ? (
        <p className="p-6 text-sm text-slate-400">Chargement…</p>
      ) : (
        <div className="mx-auto max-w-5xl space-y-6 p-6">
          <section aria-labelledby="account-title" className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="account-title" className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-emerald-400" />Compte Framateam</h2>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">{settings ? sourceLabels[settings.source] : "…"}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Compte utilisateur utilisé pour lire les canaux publics et répondre. Privilégiez un compte dédié (ex. assistant-lov) sans double authentification.</p>
            <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-slate-300">URL de l&apos;instance
                <input className={`${input} mt-1`} type="url" required value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
              </label>
              <label className="text-xs text-slate-300">Équipe (nom dans l&apos;URL)
                <input className={`${input} mt-1`} required value={form.teamName} placeholder="lov" onChange={(e) => setForm({ ...form, teamName: e.target.value })} />
              </label>
              <label className="text-xs text-slate-300">Identifiant (nom d&apos;utilisateur ou e-mail)
                <input className={`${input} mt-1`} required autoComplete="off" value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })} />
              </label>
              <label className="text-xs text-slate-300">Mot de passe
                <input
                  className={`${input} mt-1`} type="password" autoComplete="new-password" value={form.password}
                  placeholder={settings?.passwordConfigured && settings.source === "database" ? "•••••••• configuré — laisser vide pour conserver" : "Mot de passe du compte"}
                  required={!(settings?.passwordConfigured && settings.source === "database")}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                {settings?.passwordError && <span className="mt-1 block text-amber-300">{settings.passwordError}</span>}
              </label>
              <label className="text-xs text-slate-300">Mot-clé déclencheur du bot
                <input className={`${input} mt-1`} required minLength={2} value={form.triggerKeyword} onChange={(e) => setForm({ ...form, triggerKeyword: e.target.value })} />
              </label>
              <label className="text-xs text-slate-300">Synchronisation automatique (minutes, ≥ 15)
                <input className={`${input} mt-1`} type="number" min={15} max={1440} required value={form.syncIntervalMin} onChange={(e) => setForm({ ...form, syncIntervalMin: Number(e.target.value) })} />
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-300 sm:col-span-2">
                <input type="checkbox" className="mt-0.5" checked={form.acceptMentions} onChange={(e) => setForm({ ...form, acceptMentions: e.target.checked })} />
                <span>Répondre aussi aux @mentions du compte — uniquement avec un compte dédié à l&apos;assistant (sinon chaque mention de la personne déclencherait le bot).</span>
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="submit" className={primary} disabled={busy !== null}><Save className="h-3.5 w-3.5" />{busy === "save" ? "Enregistrement…" : "Enregistrer"}</button>
                <button type="button" className={secondary} onClick={() => void test()} disabled={busy !== null || settings?.source === "none"}>
                  <PlugZap className="h-3.5 w-3.5" />{busy === "test" ? "Test en cours…" : "Tester la connexion"}
                </button>
              </div>
            </form>
            <NoticeLine notice={accountNotice} />
          </section>

          <section aria-labelledby="channels-title" className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="channels-title" className="text-sm font-semibold">Canaux publics</h2>
              <div className="flex gap-2">
                <button type="button" className={secondary} onClick={() => void run("refresh", () => loadChannels(true), setChannelNotice)} disabled={busy !== null || settings?.source === "none"}>
                  <RefreshCw className={`h-3.5 w-3.5 ${busy === "refresh" ? "animate-spin" : ""}`} />Actualiser la liste
                </button>
                <button type="button" className={primary} onClick={() => void startSync()} disabled={busy !== null || !!sync?.running || !channels.some((c) => c.indexEnabled)}>
                  <RefreshCw className={`h-3.5 w-3.5 ${sync?.running ? "animate-spin" : ""}`} />{sync?.running ? "Synchronisation…" : "Synchroniser maintenant"}
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Rien n&apos;est indexé sans votre accord : cochez « Indexer » pour ajouter un canal au RAG, « Bot » pour que l&apos;assistant réponde au mot-clé dans ce canal. Seuls les canaux publics sont proposés ; les noms des auteurs ne sont jamais indexés.
            </p>
            {sync?.finishedAt && !sync.running && <p className="mt-1 text-[11px] text-slate-500">Dernière synchronisation lancée ici : {formatDate(sync.finishedAt)}</p>}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] uppercase tracking-wider text-slate-400">
                  <tr className="border-b border-slate-800">
                    <th className="py-2 pr-3 font-medium">Canal</th>
                    <th className="py-2 pr-3 font-medium">Indexer</th>
                    <th className="py-2 pr-3 font-medium">Bot</th>
                    <th className="py-2 pr-3 font-medium">Messages lus</th>
                    <th className="py-2 pr-3 font-medium">Fils indexés</th>
                    <th className="py-2 pr-3 font-medium">Dernière synchro</th>
                    <th className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {channels.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-slate-400">Aucun canal. Configurez le compte puis « Actualiser la liste ».</td></tr>
                  )}
                  {channels.map((channel) => (
                    <tr key={channel.channelId} className="border-b border-slate-800/60 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-200">{channel.displayName}</div>
                        <div className="text-slate-500">~{channel.name}</div>
                        {channel.lastError && <div className="mt-1 text-amber-300">{channel.lastError}</div>}
                      </td>
                      <td className="py-2 pr-3">
                        <input type="checkbox" aria-label={`Indexer ~${channel.name}`} checked={channel.indexEnabled} disabled={busy !== null} onChange={() => toggle(channel, "indexEnabled")} />
                      </td>
                      <td className="py-2 pr-3">
                        <input type="checkbox" aria-label={`Bot actif dans ~${channel.name}`} checked={channel.listenEnabled} disabled={busy !== null} onChange={() => toggle(channel, "listenEnabled")} />
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {channel.postsRead.toLocaleString("fr-FR")}
                        {channel.lastRunPosts > 0 && channel.lastRunPosts !== channel.postsRead && (
                          <div className="text-slate-500">+{channel.lastRunPosts.toLocaleString("fr-FR")} à la dernière synchro</div>
                        )}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{channel.threads}{channel.indexEnabled && !channel.initialDone ? <span className="ml-1 text-slate-500">(chargement initial à faire)</span> : null}</td>
                      <td className="py-2 pr-3 text-slate-400">{formatDate(channel.lastSyncedAt)}</td>
                      <td className="py-2 text-right">
                        {channel.threads > 0 && (
                          <button type="button" className={danger} onClick={() => forgetChannel(channel)} disabled={busy !== null}>
                            <Trash2 className="h-3.5 w-3.5" />Retirer de l&apos;index
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <NoticeLine notice={channelNotice} />
          </section>

          <section aria-labelledby="gdpr-title" className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 id="gdpr-title" className="text-sm font-semibold">Retirer un message (RGPD)</h2>
            <p className="mt-1 text-xs text-slate-400">Collez le permalien du message (menu « Copier le lien » dans Framateam). Il est retiré de l&apos;index immédiatement et ne sera plus jamais indexé.</p>
            <form onSubmit={forgetPost} className="mt-3 flex flex-wrap gap-2">
              <input className={`${input} min-w-[16rem] flex-1`} required value={permalink} placeholder="https://framateam.org/<équipe>/pl/<id>" onChange={(e) => setPermalink(e.target.value)} />
              <button type="submit" className={danger} disabled={busy !== null}><Trash2 className="h-3.5 w-3.5" />{busy === "forget" ? "Retrait…" : "Retirer ce message"}</button>
            </form>
            <NoticeLine notice={forgetNotice} />
          </section>
        </div>
      )}
    </main>
  );
}
