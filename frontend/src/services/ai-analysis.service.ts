import api from './api';

export interface AiAnalysis {
  id: number;
  supersedesId: number | null;
  provider: string;
  model: string;
  relevanceScore: number;
  relevanceReason: string;
  summary: string | null;
  potentialImpacts: string[];
  recommendedChecks: string[];
  classification: {
    watchType: string | null;
    themes: string[];
    domains: string[];
    keywords: string[];
    keywordWeights: number[];
    laboratories: string[];
    rationale: string;
  };
  status: 'PROPOSED' | 'REVIEWED';
  createdAt: string;
  reviewedBy: { id: number; firstName?: string; lastName?: string; email: string } | null;
}

export interface AiAnalysisState {
  enabled: boolean;
  autoAnalysisEnabled: boolean;
  latest: AiAnalysis | null;
  history: AiAnalysis[];
}

export type AiAnalysisReview = Partial<Pick<AiAnalysis,
  'relevanceScore' | 'relevanceReason' | 'summary' | 'potentialImpacts' | 'recommendedChecks' | 'classification'>>;

export function getAiAnalysis(id: number) {
  return api.get<AiAnalysisState>(`/watch-items/${id}/ai-analysis`);
}

export function requestAiAnalysis(id: number, force = false) {
  return api.post<AiAnalysis>(`/watch-items/${id}/ai-analysis`, { force });
}

export function reviewAiAnalysis(id: number, analysisId: number, changes: AiAnalysisReview) {
  return api.patch<AiAnalysis>(`/watch-items/${id}/ai-analysis/${analysisId}/review`, changes);
}
