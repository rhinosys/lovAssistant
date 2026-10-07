import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { answerQuestion } from "./answer";
import { collectEvidence, NO_EVIDENCE } from "./grounding";
import { searchWebGuidance } from "./web-guidance";
import { setModelProvider } from "@/server/model";
import { ChatModelProvider, ChatOptions } from "@/server/model/types";

vi.mock("./web-guidance", () => ({ searchWebGuidance: vi.fn() }));
vi.mock("./grounding", async importOriginal => {
  const original = await importOriginal<typeof import("./grounding")>();
  return { ...original, collectEvidence: vi.fn() };
});

const source = { id: "S1", title: "Laser K40", url: "https://example.org/k40", origin: "DokuWiki" as const, content: "Allumer l'extraction avant la découpe." };

const providerReturning = (...outputs: string[]) => {
  const calls: ChatOptions[] = [];
  const provider: ChatModelProvider = {
    providerType: "mistral",
    async *streamChat(options) {
      calls.push(options);
      yield { text: outputs[Math.min(calls.length - 1, outputs.length - 1)], totalTokens: 10 };
    },
    async checkHealth() { return { healthy: true, latencyMs: 1 }; },
    async checkModelAvailability() { return true; },
  };
  return { provider, calls };
};

describe("answerQuestion", () => {
  beforeEach(() => vi.mocked(searchWebGuidance).mockReset());
  afterEach(() => setModelProvider(null));

  it("drafts, reviews and renders a sourced answer", async () => {
    vi.mocked(collectEvidence).mockResolvedValue([source]);
    const answer = JSON.stringify({ answer: "Allume l'extraction.", sourceIds: ["S1"], needsWeb: false, webQuery: "" });
    const { provider, calls } = providerReturning(answer, answer);
    setModelProvider(provider);

    const result = await answerQuestion({ question: "Laser ?", userHistory: [{ role: "user", content: "Laser ?" }] });

    expect(calls).toHaveLength(2);
    expect(result.text).toContain("Allume l'extraction.");
    expect(result.text).toContain("Sources : [Laser K40](<https://example.org/k40>)");
    expect(result.totalTokens).toBe(20);
    expect(result.provider).toBe("mistral");
  });

  it("returns NO_EVIDENCE without review when no source is found", async () => {
    vi.mocked(collectEvidence).mockResolvedValue([]);
    const { provider, calls } = providerReturning(JSON.stringify({ answer: "x", sourceIds: [], needsWeb: false }));
    setModelProvider(provider);

    const result = await answerQuestion({ question: "?", userHistory: [{ role: "user", content: "?" }] });

    expect(calls).toHaveLength(1);
    expect(result.text).toBe(NO_EVIDENCE);
  });

  it("appends web guidance when the model requests a web search", async () => {
    vi.mocked(collectEvidence).mockResolvedValue([source]);
    vi.mocked(searchWebGuidance).mockResolvedValue("**Piste web**");
    const answer = JSON.stringify({ answer: "Non documenté.", sourceIds: ["S1"], needsWeb: true, webQuery: "bambu a1 mini wifi" });
    const { provider } = providerReturning(answer, answer);
    setModelProvider(provider);

    const result = await answerQuestion({ question: "Wifi ?", userHistory: [{ role: "user", content: "Wifi ?" }] });

    expect(searchWebGuidance).toHaveBeenCalledWith("bambu a1 mini wifi", undefined);
    expect(result.text).toContain("Non documenté.");
    expect(result.text).toContain("**Piste web**");
  });
});
