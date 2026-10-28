import api from "./api";
export interface SearchParams {
  q?: string;
  status?: string;
  criticality?: string;
  watchType?: string;
  sourceType?: string;
  aiQualified?: boolean;
  sourceId?: number;
  domainId?: number;
  laboratoryId?: number;
  favoritesOnly?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}
export function searchWatchItems(params: SearchParams, signal?: AbortSignal) {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  );

  return api.get("/search/watch-items", {
    params: {
      ...cleanParams,
      favoritesOnly: params.favoritesOnly ? true : undefined,
    },
    signal,
  });
}
