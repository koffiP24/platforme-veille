import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import { AuditGroup, AuditQueryDto } from './audit-query.dto';

const MAX_VISIBLE_AUDIT_LOGS = 500;
const AUDIT_GROUP_ENTITIES: Record<Exclude<AuditGroup, 'all'>, string[]> = {
  users: ['users'],
  watch: ['watch_items', 'saved_views'],
  sources: ['sources', 'connectors', 'collection_runs'],
  taxonomy: ['topics', 'domains', 'laboratories', 'keywords', 'keyword_synonyms'],
  actions: ['follow_up_actions'],
  alerts: ['subscriptions', 'notifications'],
  reports: ['reports'],
  access: ['auth'],
};
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private repo: Repository<AuditLog>,
    @InjectRepository(User) private users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}
  async log(data: {
    userId?: number;
    action: string;
    entity: string;
    entityId?: number;
    beforeValue?: any;
    afterValue?: any;
    ipAddress?: string;
  }) {
    const user = data.userId
      ? await this.users.findOne({ where: { id: data.userId } })
      : null;
    return this.repo.save(
      this.repo.create({
        action: data.action,
        entity: data.entity,
        entityId: data.entityId ?? null,
        beforeValue: data.beforeValue ?? null,
        afterValue: data.afterValue ?? null,
        ipAddress: data.ipAddress ?? null,
        user,
      }),
    );
  }
  async list(query: AuditQueryDto = new AuditQueryDto()) {
    const groupEntities = query.group && query.group !== 'all'
      ? AUDIT_GROUP_ENTITIES[query.group]
      : undefined;
    const where = groupEntities ? { entity: In(groupEntities) } : undefined;
    const total = await this.repo.count({ where });
    const visibleTotal = Math.min(total, MAX_VISIBLE_AUDIT_LOGS);
    const limit = query.limit ?? 20;
    const maxPage = Math.max(0, Math.ceil(visibleTotal / limit) - 1);
    const page = Math.min(query.page ?? 0, maxPage);
    const logs = await this.repo.find({
      where,
      relations: { user: true },
      order: { createdAt: 'DESC' },
      skip: page * limit,
      take: limit,
    });
    return {
      items: await this.withReadableReferences(logs),
      total,
      page,
      limit,
      capped: total > MAX_VISIBLE_AUDIT_LOGS,
    };
  }

  private async withReadableReferences(logs: AuditLog[]) {
    const fieldKinds: Record<string, string> = {
      userId: 'users', ownerId: 'users', reviewerId: 'users',
      watchItemId: 'watch_items', sourceId: 'sources', connectorId: 'connectors',
      runId: 'collection_runs', topicId: 'topics', parentId: 'topics',
      domainId: 'domains', laboratoryId: 'laboratories', keywordId: 'keywords',
      topicIds: 'topics', domainIds: 'domains', laboratoryIds: 'laboratories', keywordIds: 'keywords',
    };
    const entityKinds: Record<string, string> = {
      users: 'users', watch_items: 'watch_items', sources: 'sources', connectors: 'connectors',
      collection_runs: 'collection_runs', topics: 'topics', domains: 'domains',
      laboratories: 'laboratories', keywords: 'keywords', follow_up_actions: 'follow_up_actions',
      saved_views: 'saved_views', notifications: 'notifications', reports: 'reports',
    };
    const ids = new Map<string, Set<number>>();
    const add = (kind: string, value: unknown) => {
      const values = Array.isArray(value) ? value : [value];
      for (const entry of values) {
        const id = Number(entry);
        if (!Number.isInteger(id) || id <= 0) continue;
        if (!ids.has(kind)) ids.set(kind, new Set());
        ids.get(kind)!.add(id);
      }
    };
    for (const log of logs) {
      const entityKind = entityKinds[log.entity];
      if (entityKind && log.entityId) add(entityKind, log.entityId);
      for (const value of [log.beforeValue, log.afterValue]) {
        if (!value) continue;
        for (const [key, entry] of Object.entries(value)) {
          if (fieldKinds[key]) add(fieldKinds[key], entry);
        }
      }
    }

    const queries: Record<string, string> = {
      users: `SELECT id, COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), email) AS label FROM users WHERE id = ANY($1::int[])`,
      watch_items: `SELECT id, title AS label FROM watch_items WHERE id = ANY($1::int[])`,
      sources: `SELECT id, name AS label FROM sources WHERE id = ANY($1::int[])`,
      connectors: `SELECT c.id, CONCAT(s.name, ' – ', c.connector_type) AS label FROM connectors c JOIN sources s ON s.id = c.source_id WHERE c.id = ANY($1::int[])`,
      collection_runs: `SELECT r.id, CONCAT('Collecte ', r.id, ' – ', s.name) AS label FROM collection_runs r JOIN connectors c ON c.id = r.connector_id JOIN sources s ON s.id = c.source_id WHERE r.id = ANY($1::int[])`,
      topics: `SELECT id, label FROM topics WHERE id = ANY($1::int[])`,
      domains: `SELECT id, name AS label FROM domains WHERE id = ANY($1::int[])`,
      laboratories: `SELECT id, name AS label FROM laboratories WHERE id = ANY($1::int[])`,
      keywords: `SELECT id, label FROM keywords WHERE id = ANY($1::int[])`,
      follow_up_actions: `SELECT id, title AS label FROM actions WHERE id = ANY($1::int[])`,
      saved_views: `SELECT id, name AS label FROM saved_views WHERE id = ANY($1::int[])`,
      notifications: `SELECT id, title AS label FROM notifications WHERE id = ANY($1::int[])`,
      reports: `SELECT id, CONCAT('Rapport ', report_type) AS label, title FROM reports WHERE id = ANY($1::int[])`,
    };
    const lookups = new Map<string, Map<number, string>>();
    const reportTitles = new Map<number, string>();
    await Promise.all([...ids.entries()].map(async ([kind, kindIds]) => {
      if (!queries[kind] || !kindIds.size) return;
      try {
        const rows = await this.dataSource.query(queries[kind], [[...kindIds]]) as Array<{
          id: number;
          label: string;
          title?: string;
        }>;
        lookups.set(kind, new Map(rows.map((row: { id: number; label: string }) => [Number(row.id), row.label])));
        if (kind === 'reports') {
          rows.forEach((row) => {
            if (typeof row.title === 'string') reportTitles.set(Number(row.id), row.title);
          });
        }
      } catch {
        lookups.set(kind, new Map());
      }
    }));

    const readableRecord = (value: Record<string, unknown> | null) => {
      if (!value) return value;
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
        const kind = fieldKinds[key];
        if (!kind) return [key, entry];
        const resolve = (raw: unknown) => lookups.get(kind)?.get(Number(raw)) ?? raw;
        return [key, Array.isArray(entry) ? entry.map(resolve) : resolve(entry)];
      }));
    };
    return logs.map((log) => {
      const kind = entityKinds[log.entity];
      const reportTitle = kind === 'reports' && log.entityId
        ? reportTitles.get(log.entityId)
        : null;
      const reportScope = reportTitle?.includes('publiées uniquement')
        ? 'Veilles publiées uniquement'
        : reportTitle?.includes('tous statuts')
          ? 'Toutes les veilles'
          : null;
      const storedLabel = (log.afterValue ?? log.beforeValue)?.title
        ?? (log.afterValue ?? log.beforeValue)?.name
        ?? (log.afterValue ?? log.beforeValue)?.label;
      return {
        ...log,
        beforeValue: readableRecord(log.beforeValue),
        afterValue: readableRecord(log.afterValue),
        entityDisplay: (kind && log.entityId ? lookups.get(kind)?.get(log.entityId) : null)
          ?? (typeof storedLabel === 'string' ? storedLabel : null),
        ...(kind === 'reports' ? { reportScope: reportScope ?? 'Non précisé (rapport antérieur)' } : {}),
      };
    });
  }
}
