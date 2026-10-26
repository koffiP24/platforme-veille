import api from "./api";

export interface Source {
  id: number;
  name: string;
  organization: string | null;
  country: string | null;
  category: string;
  sourceType: string;
  baseUrl: string | null;
  frequency: string | null;
  active: boolean;
  connectors?: {
    id: number;

    connectorType: string;

    status: string;

    lastSyncAt?: string | null;

    config?: Record<string, unknown> | null;
  }[];
  initialCollection?: InitialCollectionSummary;
}

export interface InitialCollectionSummary {
  status: 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'IN_PROGRESS' | 'FAILED' | 'SKIPPED';
  received?: number;
  created?: number;
  updated?: number;
  duplicates?: number;
  errors?: number;
  message?: string;
}

export function updateConnector(
  connectorId: number,
  config: Record<string, unknown>,
) {
  return api.patch(`/connectors/${connectorId}`, {
    config,
  });
}

export interface CreateSourcePayload {
  name: string;
  organization?: string;
  country?: string;
  category: string;
  sourceType: string;
  query?: string;
  baseUrl?: string;
  frequency?: string;
  active?: boolean;
}

export function getSources() {
  return api.get<Source[]>("/sources");
}

export function createSource(payload: CreateSourcePayload) {
  return api.post<Source>("/sources", payload);
}

export function updateSource(
  id: number,
  payload: Partial<CreateSourcePayload>,
) {
  return api.patch<Source>(`/sources/${id}`, payload);
}

export function createConnector(
  sourceId: number,
  connectorType: string,
  config: Record<string, unknown>,
) {
  return api.post("/connectors", { sourceId, connectorType, config });
}

export function updateSourceStatus(id: number, active: boolean) {
  return api.patch<Source>(`/sources/${id}/status`, { active });
}

export function testConnector(connectorId: number) {
  return api.post<{ success: boolean; message: string }>(
    `/connectors/${connectorId}/test`,
  );
}

export type CollectionRunResult =
  | {
      runId: number;
      source: string;
      received: number;
      ignored: number;
      created: number;
      updated: number;
      duplicates: number;
      errors: number;
    }
  | { message: string };

export function runConnector(connectorId: number) {
  return api.post<CollectionRunResult>(`/connectors/${connectorId}/run`);
}

export interface ManualImportResult {
  runId: number;
  source: string;
  received: number;
  created: number;
  updated: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
}

export function importManualSource(sourceId: number, file: File) {
  const body = new FormData();
  body.append("file", file);
  return api.post<ManualImportResult>(`/sources/${sourceId}/import`, body);
}
