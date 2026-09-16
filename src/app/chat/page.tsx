"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Bot,
  User,
  Plus,
  Trash2,
  Send,
  RotateCcw,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Cloud,
  Cpu,
  Zap,
} from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";

interface ThreadSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface MessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  metadata?: {
    model?: string;
    provider?: string;
    tokenCount?: number;
    latencyMs?: number;
    citations?: Array<{ id: string; title: string; url: string }>;
    approvalRequired?: boolean;
    toolCall?: { name: string; params: Record<string, unknown> };
  };
}

export type LLMProviderChoice = "ollama" | "mistral";

const DEFAULT_MISTRAL_MODELS = [
  { id: "mistral-small-latest", name: "Mistral Small (Rapide & Économique)" },
  { id: "mistral-large-latest", name: "Mistral Large (Raisonnement avancé)" },
  { id: "codestral-latest", name: "Codestral (Code & Scripts)" },
  { id: "open-mistral-7b", name: "Mistral 7B (Open Source)" },
];

const DEFAULT_OLLAMA_MODELS = [
  { id: "hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL", name: "Qwen3 8B Fablab (LAN)" },
  { id: "hf.co/unsloth/Qwen3.8-27B-GGUF:UD-Q4_K_M", name: "Qwen3.8 27B Fablab (LAN)" },
];

export default function ChatPage() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderChoice>("mistral");
  const [selectedModel, setSelectedModel] = useState<string>("mistral-small-latest");
  const [ollamaModels, setOllamaModels] = useState(DEFAULT_OLLAMA_MODELS);
  const [mistralModels, setMistralModels] = useState(DEFAULT_MISTRAL_MODELS);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load threads list on mount
  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/threads");
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      }
    } catch {
      // Failed to load threads silently
    }
  }, []);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Dynamically load installed models from backend
  useEffect(() => {
    async function loadProviderModels() {
      try {
        const res = await fetch("/api/health/ready");
        if (res.ok) {
          const data = await res.json();
          const installedOllama = data.dependencies?.ollama?.models;
          if (Array.isArray(installedOllama) && installedOllama.length > 0) {
            const mapped = installedOllama.map((id: string) => {
              const simpleName = id.includes("Qwen3.8")
                ? "Qwen 3.8 27B (Local LAN)"
                : id.includes("Qwen3-8B")
                ? "Qwen 3 8B (Local LAN)"
                : id;
              return { id, name: simpleName };
            });
            setOllamaModels(mapped);
          }

          const installedMistral = data.dependencies?.mistral?.models;
          if (Array.isArray(installedMistral) && installedMistral.length > 0) {
            const prioritized = [
              "mistral-small-latest",
              "mistral-large-latest",
              "codestral-latest",
              "ministral-8b-latest",
              "open-mistral-7b",
            ];
            const mapped = installedMistral
              .filter((id: string) => prioritized.includes(id))
              .map((id: string) => ({
                id,
                name:
                  id === "mistral-small-latest"
                    ? "Mistral Small (Rapide & Économique)"
                    : id === "mistral-large-latest"
                    ? "Mistral Large (Raisonnement avancé)"
                    : id === "codestral-latest"
                    ? "Codestral (Code & Scripts)"
                    : id === "ministral-8b-latest"
                    ? "Ministral 8B (Compact)"
                    : id,
              }));
            if (mapped.length > 0) {
              setMistralModels(mapped);
            }
          }
        }
      } catch {
        // Fallback to static defaults
      }
    }
    loadProviderModels();
  }, []);

  // Load messages for a specific thread
  const selectThread = async (threadId: string) => {
    if (isLoading) return;
    setActiveThreadId(threadId);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/threads/${threadId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      } else {
        const err = await res.json();
        setErrorMessage(err.error?.message || "Impossible de charger la conversation.");
      }
    } catch {
      setErrorMessage("Erreur réseau lors du chargement de la conversation.");
    }
  };

  const startNewConversation = () => {
    if (isLoading) return;
    setActiveThreadId(null);
    setMessages([]);
    setErrorMessage(null);
    setInputValue("");
  };

  const deleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer cette conversation ?")) return;

    try {
      const res = await fetch(`/api/threads/${threadId}`, { method: "DELETE" });
      if (res.ok) {
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        if (activeThreadId === threadId) {
          startNewConversation();
        }
      }
    } catch {
      setErrorMessage("Échec de la suppression de la conversation.");
    }
  };

  const sendMessage = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || isLoading) return;

    setErrorMessage(null);
    setInputValue("");

    const tempUserMsgId = `temp_usr_${Date.now()}`;
    const tempAssistantMsgId = `temp_ast_${Date.now()}`;

    const newMessages: MessageItem[] = [
      ...messages,
      { id: tempUserMsgId, role: "user", content: trimmed },
      { id: tempAssistantMsgId, role: "assistant", content: "" },
    ];

    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: activeThreadId || undefined,
          message: trimmed,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          provider: selectedProvider,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        let errDesc = "Erreur du serveur";
        let errCode = "";
        try {
          const errData = await response.json();
          errDesc = errData.error?.message || errDesc;
          errCode = errData.error?.code || "";
        } catch {
          errDesc = response.statusText;
        }

        if (response.status === 401 || errCode === "MISTRAL_AUTH_ERROR") {
          errDesc = "Clé API Mistral invalide ou non configurée. Vérifiez la variable MISTRAL_API_KEY dans votre fichier .env.";
        } else if (response.status === 429 || errCode === "MISTRAL_RATE_LIMIT") {
          errDesc = "Quota ou limite de requêtes Mistral AI atteinte. Réessayez dans quelques instants ou basculez sur Ollama Local.";
        } else if (errCode === "OLLAMA_UNAVAILABLE") {
          errDesc = "Le serveur Ollama local est injoignable. Vérifiez qu'Ollama est bien démarré sur le réseau.";
        }

        throw new Error(errDesc);
      }

      const receivedThreadId = response.headers.get("x-thread-id");
      if (receivedThreadId && !activeThreadId) {
        setActiveThreadId(receivedThreadId);
        fetchThreads();
      }

      if (!response.body) {
        throw new Error("Flux de réponse vide.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data: ")) continue;
          const jsonStr = trimmedLine.replace(/^data:\s*/, "");

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.event === "text" && parsed.text) {
              assistantText += parsed.text;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === tempAssistantMsgId
                    ? { ...msg, content: assistantText }
                    : msg
                )
              );
            } else if (parsed.event === "error") {
              throw new Error(parsed.error);
            } else if (parsed.event === "thread" && parsed.threadId) {
              setActiveThreadId(parsed.threadId);
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
              throw e;
            }
          }
        }
      }

      // Refresh threads list after completed exchange
      fetchThreads();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inattendue de génération";
      setErrorMessage(message);
      // Remove empty pending assistant bubble if nothing was streamed
      setMessages((prev) =>
        prev.filter((m) => m.id !== tempAssistantMsgId || m.content.length > 0)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    // Find the last user message to retry
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      // Remove trailing assistant error message if any
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === lastUserMsg.id);
        return prev.slice(0, idx);
      });
      sendMessage(lastUserMsg.content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 antialiased overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-slate-200 hover:text-white transition-colors"
          >
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm leading-none">Assistant Fablab</div>
              <div className="text-[11px] text-slate-400 mt-1">Inférence Locale</div>
            </div>
          </Link>
          <Link
            href="/"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Retour à l'accueil"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* New Thread Button */}
        <div className="p-3">
          <button
            onClick={startNewConversation}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-xl font-medium text-sm transition-all shadow-sm hover:shadow-emerald-600/20 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Nouvelle conversation
          </button>
        </div>

        {/* Provider & Model Select in Sidebar */}
        <div className="px-3 pb-2 space-y-2">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider px-2">
            Moteur d'inférence
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setSelectedProvider("ollama");
                if (ollamaModels.length > 0) {
                  setSelectedModel(ollamaModels[0].id);
                }
              }}
              disabled={isLoading}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                selectedProvider === "ollama"
                  ? "bg-emerald-600/90 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Ollama
            </button>
            <button
              onClick={() => {
                setSelectedProvider("mistral");
                if (mistralModels.length > 0) {
                  setSelectedModel(mistralModels[0].id);
                }
              }}
              disabled={isLoading}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                selectedProvider === "mistral"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              Mistral AI
            </button>
          </div>

          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isLoading}
            className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-slate-600 truncate"
          >
            {selectedProvider === "mistral"
              ? mistralModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))
              : ollamaModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
          </select>
        </div>

        {/* Threads List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider px-2 py-1">
            Historique ({threads.length})
          </div>
          {threads.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-8">
              Aucune conversation précédente.
            </div>
          ) : (
            threads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              return (
                <div
                  key={thread.id}
                  onClick={() => selectThread(thread.id)}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-sm transition-all ${
                    isActive
                      ? "bg-slate-800 text-white font-medium shadow-sm border border-slate-700"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <span className="truncate pr-6">{thread.title}</span>
                  <button
                    onClick={(e) => deleteThread(thread.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded transition-all"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate max-w-[190px]">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                selectedProvider === "mistral" ? "bg-indigo-400" : "bg-emerald-400"
              }`}
            ></span>
            <span className="truncate">
              {selectedProvider === "mistral" ? "Mistral AI" : "Ollama Local"}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">v0.1</span>
        </div>
      </aside>

      {/* Main Chat Container */}
      <main className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden">
        {/* Chat Header */}
        <header className="h-14 border-b border-slate-800/80 px-6 flex items-center justify-between bg-slate-950/80 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div
              className={`p-1.5 rounded-lg border ${
                selectedProvider === "mistral"
                  ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}
            >
              {selectedProvider === "mistral" ? (
                <Zap className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                {threads.find((t) => t.id === activeThreadId)?.title || "Nouvelle conversation"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedProvider === "mistral" ? (
              <span className="inline-flex items-center gap-1 text-xs bg-indigo-950/60 border border-indigo-800/60 px-2.5 py-1 rounded-full text-indigo-300">
                <Cloud className="w-3 h-3" />
                Mistral AI Cloud
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full text-emerald-300">
                <Cpu className="w-3 h-3" />
                Ollama Local LAN
              </span>
            )}
          </div>
        </header>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-16">
                <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-emerald-400 mb-4 shadow-md font-bold text-base">
                  LOV
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Assistant Atelier FabLab
                </h3>
                <p className="text-sm text-slate-400 mb-8 max-w-md">
                  Posez une question sur l&apos;utilisation d&apos;une machine, les réglages matière, ou les consignes de sécurité de l&apos;atelier.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                  <button
                    onClick={() => sendMessage("Quelles sont les précautions de sécurité pour la découpeuse laser ?")}
                    className="p-3.5 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-200 transition-all text-xs flex flex-col gap-1 shadow-sm"
                  >
                    <span className="font-medium text-slate-100">🔥 Découpeuse laser</span>
                    <span className="text-[11px] text-slate-400">Consignes de sécurité et refroidissement</span>
                  </button>
                  <button
                    onClick={() => sendMessage("Comment calibrer le plateau de l'imprimante 3D en PLA ?")}
                    className="p-3.5 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-200 transition-all text-xs flex flex-col gap-1 shadow-sm"
                  >
                    <span className="font-medium text-slate-100">🖨️ Impression 3D</span>
                    <span className="text-[11px] text-slate-400">Calibration plateau & température PLA</span>
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3.5 w-full ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium ${
                      isUser
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 border border-slate-700 text-emerald-400"
                    }`}
                  >
                    {isUser ? <User className="w-3.5 h-3.5" /> : "LOV"}
                  </div>

                  <div
                    className={`rounded-2xl p-4 sm:p-5 text-sm leading-relaxed shadow-sm flex-1 ${
                      isUser
                        ? "bg-indigo-600 text-white rounded-tr-sm max-w-2xl"
                        : "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-sm"
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    ) : (
                      <MarkdownContent content={msg.content} />
                    )}

                    {/* Metadata discret et minimal */}
                    {!isUser && msg.metadata && (msg.metadata.provider || msg.metadata.tokenCount) && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/40 flex items-center gap-2 text-[11px] text-slate-500">
                        {msg.metadata.provider && (
                          <span className="text-slate-400 font-medium">
                            {msg.metadata.provider === "mistral" ? "Mistral AI" : "Ollama Local"}
                          </span>
                        )}
                        {msg.metadata.model && (
                          <span className="truncate max-w-[140px] text-slate-500">
                            • {msg.metadata.model}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Future Extension Slot: Citations (Phase 2) */}
                    {msg.metadata?.citations && msg.metadata.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-2">
                        {msg.metadata.citations.map((c) => (
                          <a
                            key={c.id}
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-800 text-emerald-400 hover:bg-slate-700"
                          >
                            <span>[{c.id}]</span>
                            <span className="truncate max-w-[150px]">{c.title}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Future Extension Slot: Action Confirmation Card (Phase 3) */}
                    {msg.metadata?.approvalRequired && (
                      <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                        <div className="flex items-center gap-1.5 font-medium mb-1">
                          <ShieldCheck className="w-4 h-4" />
                          Confirmation d&apos;action requise
                        </div>
                        <p className="text-slate-400">
                          Cette action administrative nécessite une validation explicite.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Active Generation Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 ml-12">
              <Loader2
                className={`w-4 h-4 animate-spin ${
                  selectedProvider === "mistral" ? "text-indigo-400" : "text-emerald-400"
                }`}
              />
              <span>
                Génération en cours avec{" "}
                {selectedProvider === "mistral" ? "Mistral AI (Cloud)" : "Ollama (Local)"}...
              </span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="max-w-3xl mx-auto p-4 bg-red-950/60 border border-red-800/80 rounded-2xl flex items-start justify-between gap-3 text-red-200 text-sm shadow-lg">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-300">Erreur de génération</div>
                  <div className="text-xs text-red-200/80 mt-0.5">{errorMessage}</div>
                </div>
              </div>
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-900/60 hover:bg-red-800/80 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Réessayer
              </button>
            </div>
          )}

          </div>
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/80">
          <div className="max-w-4xl mx-auto relative flex items-center">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Écrivez votre message en français... (Entrée pour envoyer, Maj+Entrée pour saut de ligne)"
              rows={1}
              className="w-full pl-4 pr-12 py-3 bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm text-slate-100 placeholder:text-slate-400 resize-none outline-none transition-all disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-2 p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-lg transition-colors"
              title="Envoyer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="max-w-4xl mx-auto mt-2 text-[11px] text-slate-400 text-center">
            Assistant IA Fablab •{" "}
            {selectedProvider === "mistral"
              ? "Mode Cloud Mistral AI • Traitement via l'API sécurisée Mistral"
              : "Inférence privée locale • Vos données restent sur le réseau du fablab"}
          </div>
        </div>
      </main>
    </div>
  );
}
