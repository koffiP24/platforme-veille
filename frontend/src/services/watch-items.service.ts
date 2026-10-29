import api from "./api";

export interface WatchItem {
  id: number;

  title: string;

  summary: string | null;

  originalTitle?: string | null;
  originalSummary?: string | null;
  originalLanguage?: string | null;
  frenchTitle?: string | null;
  frenchSummary?: string | null;
  englishTitle?: string | null;
  englishSummary?: string | null;

  doi: string | null;

  url: string | null;

  collectedAt: string;

  language?: string | null;

  publishedAt: string | null;

  watchType: string;

  status: string;

  relevance: number | null;

  criticality: string | null;

  source: {
    id: number;
    name: string;
    sourceType: string;
    category: string;
  };
}

export function getWatchItems() {
  return api.get<WatchItem[]>("/watch-items");
}

export function getWatchItem(id: number) {
  return api.get<WatchItem>(`/watch-items/${id}`);
}

export function translateWatchItemToEnglish(id: number) {
  return api.post<WatchItem>(`/watch-items/${id}/translate-en`);
}

export function translateMissingWatchItems(limit = 10) {
  return api.post<{ processed: number; translated: number; failed: number; remaining: number }>(
    '/watch-items/translate-missing',
    { limit },
  );
}
