const BASE = "";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export interface Card {
  id: number;
  sessionId: string;
  cardIndex: number;
  type: string;
  userSaid: string;
  aiPhrased: string;
  vocab: string[];
  pattern: string;
  contextHint: string;
  userLine: number | null;
  aiLine: number | null;
  createdAt: string;
  favorite: boolean;
  hidden: boolean;
  viewCount: number;
  lastViewedAt: string | null;
}

export interface Stats {
  totalCards: number;
  totalSessions: number;
  byType: Record<string, number>;
  favoriteCount: number;
  hiddenCount: number;
}

export interface VocabEntry {
  word: string;
  count: number;
  sessions: string[];
  examples: string[];
}

export interface PatternEntry {
  pattern: string;
  count: number;
  sessions: string[];
}

export interface Lexicon {
  vocab: VocabEntry[];
  patterns: PatternEntry[];
  cardTotal: number;
}

export interface TranscriptRow {
  sessionId: string;
  sourcePath: string;
  transcriptMtime: number;
  status: "pending" | "analyzing" | "done" | "failed";
  analyzedMtime: number | null;
  error: string | null;
  model: string;
  uploadedAt: string;
  analyzedAt: string | null;
}

export interface TranscriptList {
  transcripts: TranscriptRow[];
  queue: { size: number; pending: number; inflight: number };
}

export const api = {
  cards: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchJSON<Card[]>(`/api/cards${qs}`);
  },
  daily: (limit = 8) =>
    fetchJSON<Card[]>(`/api/cards/daily?limit=${limit}`),
  stats: () => fetchJSON<Stats>("/api/cards/stats"),
  types: () => fetchJSON<string[]>("/api/cards/types"),
  lexicon: () => fetchJSON<Lexicon>("/api/lexicon"),
  favorite: (cardId: number, value: boolean) =>
    postJSON(`/api/cards/${cardId}/favorite`, { value }),
  hide: (cardId: number, value: boolean) =>
    postJSON(`/api/cards/${cardId}/hide`, { value }),
  transcripts: () => fetchJSON<TranscriptList>("/api/transcripts"),
};
