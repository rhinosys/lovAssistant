export interface YesWikiConfig {
  baseUrl: string;
  cookie?: string;
  timeoutMs?: number;
}

export interface YesWikiPage {
  pageName: string;
  title: string;
  content: string;
  canonicalUrl: string;
  lastModified?: string;
  lastAuthor?: string;
}

export interface YesWikiSearchResult {
  pageName: string;
  title: string;
  snippet: string;
  canonicalUrl: string;
}

export interface YesWikiRecentChange {
  pageName: string;
  title: string;
  author: string;
  updatedAt: string;
  canonicalUrl: string;
}

export interface YesWikiBazarEntry {
  id: string;
  title: string;
  category?: string;
  description?: string;
  fields: Record<string, unknown>;
  canonicalUrl: string;
}

export interface YesWikiMachineStatus {
  name: string;
  status: "disponible" | "maintenance" | "reserve" | "hors_service" | "inconnu";
  materials: string[];
  notes?: string;
  guideUrl?: string;
}

export interface PreparedPageUpdate {
  pageName: string;
  summary: string;
  diff: string;
  confirmationToken: string;
  expiresAt: number;
}
