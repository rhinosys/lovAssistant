import Link from "next/link";
import { Bot, MessageSquare, ShieldCheck, Database, Cpu } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
            <Bot className="w-12 h-12" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
          Assistant IA Fablab
        </h1>
        <p className="text-slate-400 mb-8 leading-relaxed">
          Assistant conversationnel auto-hébergé avec inférence locale Ollama, persistance PostgreSQL et isolation stricte des conversations.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-left">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <Cpu className="w-5 h-5 text-indigo-400 mb-2" />
            <div className="text-sm font-semibold text-slate-200">Inférence Locale</div>
            <div className="text-xs text-slate-400 mt-1">Ollama local sans recours au cloud</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <Database className="w-5 h-5 text-emerald-400 mb-2" />
            <div className="text-sm font-semibold text-slate-200">Persistance</div>
            <div className="text-xs text-slate-400 mt-1">PostgreSQL & threads durables</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <ShieldCheck className="w-5 h-5 text-amber-400 mb-2" />
            <div className="text-sm font-semibold text-slate-200">Isolation & Sécurité</div>
            <div className="text-xs text-slate-400 mt-1">Contrôles d'accès côté serveur</div>
          </div>
        </div>

        <Link
          href="/chat"
          className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors shadow-lg shadow-emerald-600/20"
        >
          <MessageSquare className="w-5 h-5" />
          Accéder à l'Assistant
        </Link>
      </div>
    </main>
  );
}
