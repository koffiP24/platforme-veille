import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { WatchItem } from '../watch-items/entities/watch-item.entity';
import { SearchWatchItemsDto } from './dto/search-watch-items.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(WatchItem) private readonly repo: Repository<WatchItem>,
  ) {}

  async search(dto: SearchWatchItemsDto, roles: string[], userId: number) {
    const qb = this.repo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.source', 'source')
      .leftJoinAndSelect('item.domains', 'domains')
      .leftJoinAndSelect('item.laboratories', 'laboratories');

    const hasInternalRole = [
      'ADMIN',
      'RESPONSABLE_VEILLE',
      'REFERENT_LABORATOIRE',
      'OPERATEUR_VEILLE',
    ].some((role) => roles.includes(role));

    if (!hasInternalRole) {
      qb.andWhere('item.status = :published', { published: 'PUBLIE' });
    } else if (dto.status)
      qb.andWhere('item.status = :status', { status: dto.status });

    if (dto.favoritesOnly) {
      qb.innerJoin(
        'favorites',
        'favorite',
        'favorite.watch_item_id = item.id AND favorite.user_id = :favoriteUserId',
        { favoriteUserId: userId },
      );
    }

    if (dto.aiQualified !== undefined) {
      const hasAiQualification = `EXISTS (
        SELECT 1 FROM watch_item_ai_analyses ai_analysis
        WHERE ai_analysis.watch_item_id = item.id
      )`;
      qb.andWhere(dto.aiQualified ? hasAiQualification : `NOT ${hasAiQualification}`);
    }

    if (dto.q?.trim()) {
      const query = dto.q.trim();
      qb.andWhere(
        new Brackets((search) => {
          search
            .where(
              "to_tsvector('simple', coalesce(item.title,'') || ' ' || coalesce(item.summary,'')) @@ plainto_tsquery('simple', :q)",
              { q: query },
            )
            .orWhere('source.name ILIKE :sourceQuery', {
              sourceQuery: `%${query}%`,
            });
        }),
      );
    }
    if (dto.criticality)
      qb.andWhere('item.criticality = :criticality', {
        criticality: dto.criticality,
      });
    if (dto.watchType)
      qb.andWhere('item.watchType = :watchType', { watchType: dto.watchType });
    if (dto.sourceType) {
      qb.andWhere('source.sourceType = :sourceType', {
        sourceType: dto.sourceType,
      });
    }
    if (dto.sourceId)
      qb.andWhere('source.id = :sourceId', { sourceId: dto.sourceId });
    if (dto.domainId)
      qb.andWhere('domains.id = :domainId', { domainId: dto.domainId });
    if (dto.laboratoryId)
      qb.andWhere('laboratories.id = :laboratoryId', {
        laboratoryId: dto.laboratoryId,
      });

    const sortMap: Record<string, string> = {
      publishedAt: 'item.publishedAt',
      collectedAt: 'item.collectedAt',
      relevance: 'item.relevance',
      criticality: 'item.criticality',
      title: 'item.title',
      sourceName: 'source.name',
      sourceType: 'source.sourceType',
      summary: 'item.summary',
      status: 'item.status',
    };
    qb.orderBy(sortMap[dto.sortBy] ?? 'item.publishedAt', dto.sortOrder);
    qb.addOrderBy('item.id', 'DESC');
    qb.skip((dto.page - 1) * dto.limit).take(dto.limit);
    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      total,
      page: dto.page,
      limit: dto.limit,
      pages: Math.ceil(total / dto.limit),
    };
  }
}
