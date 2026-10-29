import api from './api';

export interface AuditPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  capped: boolean;
}

export function getAuditLogs<T>(params: { page: number; limit: number; group: string }) {
  return api.get<AuditPage<T>>('/audit', {
    params,
    headers: { 'Cache-Control': 'no-cache' },
  });
}
