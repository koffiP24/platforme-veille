import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { criticalityFromScore } from '../common/priority';

import { InjectRepository } from '@nestjs/typeorm';

import { DataSource, In, Repository } from 'typeorm';

import { WatchItem } from '../watch-items/entities/watch-item.entity';

import { WatchItemTopic } from '../watch-items/entities/watch-item-topic.entity';

import { WatchItemKeyword } from '../watch-items/entities/watch-item-keyword.entity';

import { Topic } from '../taxonomy/entities/topic.entity';

import { Keyword } from '../taxonomy/entities/keyword.entity';

import { Domain } from '../taxonomy/entities/domain.entity';

import { Laboratory } from '../taxonomy/entities/laboratory.entity';

import { QualifyWatchItemDto } from './dto/qualify-watch-item.dto';
import { AuditService } from '../audit/audit.service';

function normalizeTaxonomyName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('fr-FR');
}

async function resolveTaxonomyNames<T extends { id: number }>(
  repository: Repository<T>,
  labels: string[] | undefined,
  getLabel: (entity: T) => string,
  build: (label: string, index: number) => T,
) {
  const entities = await repository.find();
  const byLabel = new Map(entities.map((entity) => [normalizeTaxonomyName(getLabel(entity)), entity]));
  const resolved: T[] = [];
  const created: string[] = [];
  for (const [index, rawLabel] of (labels ?? []).entries()) {
    const label = rawLabel.trim().slice(0, 150);
    const key = normalizeTaxonomyName(label);
    if (!key) continue;
    let entity = byLabel.get(key);
    if (!entity) {
      const createdEntity = repository.create(build(label, index) as unknown as T);
      entity = await repository.save(createdEntity);
      if (!entity) continue;
      byLabel.set(key, entity);
      created.push(label);
    }
    if (!resolved.some((entry) => entry.id === entity.id)) resolved.push(entity);
  }
  return { entities: resolved, created };
}

@Injectable()
export class QualificationService {
  constructor(
    @InjectRepository(WatchItem)
    private readonly itemRepository: Repository<WatchItem>,

    @InjectRepository(WatchItemTopic)
    private readonly topicLinkRepository: Repository<WatchItemTopic>,

    @InjectRepository(WatchItemKeyword)
    private readonly keywordLinkRepository: Repository<WatchItemKeyword>,

    @InjectRepository(Topic)
    private readonly topicRepository: Repository<Topic>,

    @InjectRepository(Keyword)
    private readonly keywordRepository: Repository<Keyword>,

    @InjectRepository(Domain)
    private readonly domainRepository: Repository<Domain>,

    @InjectRepository(Laboratory)
    private readonly laboratoryRepository: Repository<Laboratory>,

    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async qualify(itemId: number, dto: QualifyWatchItemDto, userId?: number) {
    const item = await this.itemRepository.findOne({
      where: {
        id: itemId,
      },

      relations: {
        domains: true,
        laboratories: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Élément de veille introuvable');
    }

    if (!['NOUVEAU', 'A_QUALIFIER'].includes(item.status)) {
      throw new ConflictException(
        'Cet élément ne peut plus être qualifié dans son état actuel.',
      );
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const itemRepository = manager.getRepository(WatchItem);
      const suggestions = dto.createMissingTaxonomy === true
        ? await (async () => {
          const [topics, domains, keywords, laboratories] = await Promise.all([
            resolveTaxonomyNames(manager.getRepository(Topic), dto.topicLabels, (entry) => entry.label, (label) => ({ label, description: null, parent: null }) as Topic),
            resolveTaxonomyNames(manager.getRepository(Domain), dto.domainNames, (entry) => entry.name, (name) => ({ name, description: null, active: true }) as Domain),
            resolveTaxonomyNames(manager.getRepository(Keyword), dto.keywordLabels, (entry) => entry.label, (label, index) => ({ label, weight: Math.min(10, Math.max(1, dto.keywordWeights?.[index] ?? 5)), active: true }) as Keyword),
            resolveTaxonomyNames(manager.getRepository(Laboratory), dto.laboratoryNames, (entry) => entry.name, (name) => ({ name, description: null, active: true }) as Laboratory),
          ]);
          return { topics, domains, keywords, laboratories };
        })()
        : null;

    const topicIds = [...new Set([...dto.topicIds, ...(suggestions?.topics.entities.map(({ id }) => id) ?? [])])];
    const domainIds = [...new Set([...dto.domainIds, ...(suggestions?.domains.entities.map(({ id }) => id) ?? [])])];
    const keywordIds = [...new Set([...dto.keywordIds, ...(suggestions?.keywords.entities.map(({ id }) => id) ?? [])])];
    const laboratoryIds = [...new Set([...dto.laboratoryIds, ...(suggestions?.laboratories.entities.map(({ id }) => id) ?? [])])];

    const beforeValue = {
      watchType: item.watchType,
      relevance: item.relevance,
      criticality: item.criticality,
      status: item.status,
      domainIds: item.domains.map((domain) => domain.id),
      laboratoryIds: item.laboratories.map((laboratory) => laboratory.id),
    };

    const topics = topicIds.length
      ? await manager.getRepository(Topic).findBy({
          id: In(topicIds),
        })
      : [];

    const keywords = keywordIds.length
      ? await manager.getRepository(Keyword).findBy({
          id: In(keywordIds),
        })
      : [];

    const domains = domainIds.length
      ? await manager.getRepository(Domain).findBy({
          id: In(domainIds),
        })
      : [];

    const laboratories = laboratoryIds.length
      ? await manager.getRepository(Laboratory).findBy({
          id: In(laboratoryIds),
        })
      : [];

    if (
      topics.length !== topicIds.length ||
      keywords.length !== keywordIds.length ||
      domains.length !== domainIds.length ||
      laboratories.length !== laboratoryIds.length
    ) {
      throw new BadRequestException(
        'Une ou plusieurs valeurs de taxonomie sont invalides.',
      );
    }

    item.watchType = dto.watchType ?? item.watchType;
    item.relevance = dto.relevance;

    item.criticality = criticalityFromScore(dto.relevance);

    item.domains = domains;

    item.laboratories = laboratories;

    item.status = 'A_QUALIFIER';

    await itemRepository.save(item);

    const topicLinkRepository = manager.getRepository(WatchItemTopic);
    const keywordLinkRepository = manager.getRepository(WatchItemKeyword);
    await topicLinkRepository.delete({
      watchItemId: item.id,
    });

    await keywordLinkRepository.delete({
      watchItemId: item.id,
    });

    if (topics.length) {
      await topicLinkRepository.save(
        topics.map((topic) =>
          topicLinkRepository.create({
            watchItemId: item.id,

            topicId: topic.id,

            watchItem: item,

            topic,

            confidence: 1,

            origin: 'HUMAN',
          }),
        ),
      );
    }

    if (keywords.length) {
      await keywordLinkRepository.save(
        keywords.map((keyword) =>
          keywordLinkRepository.create({
            watchItemId: item.id,

            keywordId: keyword.id,

            watchItem: item,

            keyword,

            confidence: 1,

            origin: 'HUMAN',
          }),
        ),
      );
    }

    const qualified = await itemRepository.findOne({
      where: { id: item.id },
      relations: {
        source: true,
        domains: true,
        laboratories: true,
        topicLinks: { topic: true },
        keywordLinks: { keyword: true },
      },
    });
    if (!qualified) throw new NotFoundException('Élément introuvable');

    return {
      qualified,
      beforeValue,
      createdTaxonomy: suggestions ? {
        topics: suggestions.topics.created,
        domains: suggestions.domains.created,
        keywords: suggestions.keywords.created,
        laboratories: suggestions.laboratories.created,
      } : {},
    };
    });

    await this.auditService.log({
      userId,
      action: 'QUALIFY_WATCH_ITEM',
      entity: 'watch_items',
      entityId: item.id,
      beforeValue: result.beforeValue,
      afterValue: {
        watchType: result.qualified.watchType,
        relevance: result.qualified.relevance,
        criticality: result.qualified.criticality,
        status: result.qualified.status,
        domainIds: result.qualified.domains.map((domain) => domain.id),
        laboratoryIds: result.qualified.laboratories.map(
          (laboratory) => laboratory.id,
        ),
        topicIds: result.qualified.topicLinks.map((link) => link.topic.id),
        keywordIds: result.qualified.keywordLinks.map((link) => link.keyword.id),
        createdTaxonomy: result.createdTaxonomy,
      },
    });

    return result.qualified;
  }

  async getQualification(itemId: number) {
    const item = await this.itemRepository.findOne({
      where: {
        id: itemId,
      },

      relations: {
        source: true,
        domains: true,
        laboratories: true,

        topicLinks: {
          topic: true,
        },

        keywordLinks: {
          keyword: true,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Élément introuvable');
    }

    return item;
  }
}
