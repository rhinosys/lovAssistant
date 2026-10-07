import { getModelProvider, ChatMessage, LLMProviderType } from "@/server/model";
import { searchWebGuidance } from "@/server/chat/web-guidance";
import { collectEvidence, evidencePrompt, renderEvidence, NO_EVIDENCE, webFallbackQuery } from "@/server/chat/grounding";

export interface AnswerOptions {
  question: string;
  // Only member questions: prior assistant answers are not evidence.
  userHistory: ChatMessage[];
  provider?: LLMProviderType;
  model?: string;
  signal?: AbortSignal;
}

export interface AnswerResult {
  text: string;
  totalTokens: number;
  provider: string;
}

const MAX_ANSWER_CHARS = 30000;

const collect = async (stream: AsyncIterable<{ text: string; totalTokens?: number }>) => {
  let text = "";
  let totalTokens = 0;
  for await (const chunk of stream) {
    text += chunk.text || "";
    if (chunk.totalTokens) totalTokens = chunk.totalTokens;
    if (text.length > MAX_ANSWER_CHARS) return { text: "", totalTokens };
  }
  return { text, totalTokens };
};

// Shared grounded pipeline for the web chat and the Framateam bot:
// evidence → draft → factual review → trusted rendering → optional web fallback.
export const answerQuestion = async ({ question, userHistory, provider, model, signal }: AnswerOptions): Promise<AnswerResult> => {
  const sources = await collectEvidence(userHistory.map(item => item.content).join("\n"));
  const modelProvider = getModelProvider(provider);
  const providerName = modelProvider.providerType || provider || "default";

  const draft = await collect(modelProvider.streamChat({
    messages: [{ role: "system", content: evidencePrompt(sources) }, ...userHistory],
    model,
    abortSignal: signal,
    temperature: 0,
  }));
  let text = draft.text;
  let totalTokens = draft.totalTokens;

  // Review the draft for unsupported details while keeping a useful, natural guide.
  if (sources.length && text) {
    const reviewed = await collect(modelProvider.streamChat({
      messages: [
        { role: "system", content: `${evidencePrompt(sources)}\nTu es le relecteur factuel de la réponse proposée. Supprime toute précision qui n'est pas étayée : emplacement d'un bouton, confirmation sur un écran, canal de communication, valeur technique ou état d'une machine. Une liste seule ne prouve jamais une disponibilité : remplace les affirmations « disponibles » par « référencés dans la documentation » lorsque aucun état actuel daté n’est fourni. Ne rajoute aucun détail. Conserve les étapes documentées, les précautions, la structure guidée et le ton naturel. Retourne le même JSON answer/sourceIds/needsWeb/webQuery. Si les sources sont insuffisantes pour une aide technique, conserve la demande de recherche web.` },
        { role: "user", content: JSON.stringify({ question, draft: text }) },
      ], model, temperature: 0, abortSignal: signal,
    }));
    text = reviewed.text;
    totalTokens += reviewed.totalTokens;
  }

  const searchQuery = webFallbackQuery(text);
  const localAnswer = sources.length ? renderEvidence(text, sources) : NO_EVIDENCE;
  if (searchQuery) {
    const webAnswer = await searchWebGuidance(searchQuery, signal);
    text = `${localAnswer === NO_EVIDENCE ? "Je n’ai pas trouvé assez d’informations dans la documentation du LOV pour te guider sur ce point." : localAnswer}\n\n${webAnswer ?? "La recherche web n’a pas abouti à des sources exploitables. Je préfère te le signaler plutôt qu’inventer une procédure."}`;
  } else {
    text = localAnswer;
  }
  return { text, totalTokens, provider: providerName };
};
