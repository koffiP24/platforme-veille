import api from "./api";
import type { WatchItem } from "./watch-items.service";
import type { Domain, Laboratory, Topic, Keyword } from "./taxonomy.service";

export interface Qualification extends WatchItem {
  domains?: Domain[];
  laboratories?: Laboratory[];
  topicLinks?: { topic: Topic }[];
  keywordLinks?: { keyword: Keyword }[];
}

export interface QualificationPayload {
  watchType?: string;

  relevance: number;
  
  topicIds: number[];

  keywordIds: number[];

  domainIds: number[];

  laboratoryIds: number[];
  createMissingTaxonomy?: boolean;
  topicLabels?: string[];
  domainNames?: string[];
  keywordLabels?: string[];
  keywordWeights?: number[];
  laboratoryNames?: string[];
}

export function getQualification(id: number) {
  return api.get<Qualification>(`/watch-items/${id}/qualification`);
}

export function qualifyWatchItem(id: number, payload: QualificationPayload) {
  return api.patch<Qualification>(`/watch-items/${id}/qualification`, payload);
}
