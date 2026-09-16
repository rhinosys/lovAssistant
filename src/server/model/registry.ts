import { getConfig } from "../config";
import {
  ChatModelProvider,
  LLMProviderType,
  ProviderHealthStatus,
} from "./types";
import { OllamaProvider } from "./ollama";
import { MistralProvider } from "./mistral";

const providerInstances: Partial<Record<LLMProviderType, ChatModelProvider>> = {};
let customOverrideProvider: ChatModelProvider | null = null;

export function getModelProvider(
  providerType?: LLMProviderType | string
): ChatModelProvider {
  if (customOverrideProvider) {
    return customOverrideProvider;
  }

  const config = getConfig();
  const selectedType: LLMProviderType =
    (providerType as LLMProviderType) ||
    config.DEFAULT_LLM_PROVIDER ||
    "ollama";

  if (selectedType === "mistral") {
    if (!providerInstances.mistral) {
      providerInstances.mistral = new MistralProvider();
    }
    return providerInstances.mistral;
  }

  // Default to ollama
  if (!providerInstances.ollama) {
    providerInstances.ollama = new OllamaProvider();
  }
  return providerInstances.ollama;
}

export function setModelProvider(
  provider: ChatModelProvider | null,
  providerType?: LLMProviderType
): void {
  if (!providerType) {
    customOverrideProvider = provider;
  } else {
    providerInstances[providerType] = provider ?? undefined;
  }
}

export function resetModelProviders(): void {
  customOverrideProvider = null;
  delete providerInstances.ollama;
  delete providerInstances.mistral;
}

export async function checkAllProvidersHealth(): Promise<
  Record<LLMProviderType, ProviderHealthStatus>
> {
  const ollama = getModelProvider("ollama");
  const mistral = getModelProvider("mistral");

  const [ollamaHealth, mistralHealth] = await Promise.all([
    ollama.checkHealth(),
    mistral.checkHealth(),
  ]);

  return {
    ollama: ollamaHealth,
    mistral: mistralHealth,
  };
}
