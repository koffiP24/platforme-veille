import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Source } from './entities/source.entity';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';
import { AuditService } from '../audit/audit.service';
import { ConnectorsService } from '../connectors/connectors.service';
import { CollectionService } from '../collection/collection.service';

export interface InitialCollectionResult {
  status:
    | 'COMPLETED'
    | 'COMPLETED_WITH_ERRORS'
    | 'IN_PROGRESS'
    | 'FAILED'
    | 'SKIPPED';
  received?: number;
  created?: number;
  updated?: number;
  duplicates?: number;
  errors?: number;
  message?: string;
}

@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(
    @InjectRepository(Source)
    private readonly sourceRepository: Repository<Source>,
    private readonly auditService: AuditService,
    private readonly connectorsService: ConnectorsService,
    private readonly collectionService: CollectionService,
  ) {}

  async create(dto: CreateSourceDto, actorId?: number) {
    const config = dto.sourceType === 'IMPORT_MANUEL'
      ? undefined
      : this.connectorConfig(dto);

    const source = this.sourceRepository.create({
      name: dto.name,
      organization: dto.organization ?? null,
      country: dto.country ?? null,
      category: dto.category,
      sourceType: dto.sourceType,
      baseUrl: dto.baseUrl ?? null,
      frequency: dto.frequency ?? null,
      active: dto.active ?? true,
    });

    const saved = await this.sourceRepository.save(source);
    await this.auditService.log({
      userId: actorId,
      action: 'CREATE_SOURCE',
      entity: 'sources',
      entityId: saved.id,
      afterValue: this.auditSnapshot(saved),
    });

    if (!config) return saved;

    try {
      const connector = await this.connectorsService.create({
        sourceId: saved.id,
        connectorType: saved.sourceType,
        config,
      });

      if (!saved.active) {
        return {
          ...saved,
          initialCollection: {
            status: 'SKIPPED',
            message: 'La source est inactive; aucune collecte n’a été lancée.',
          } satisfies InitialCollectionResult,
        };
      }

      const result = await this.collectionService.runConnector(connector.id, actorId);
      if ('message' in result) {
        return {
          ...saved,
          initialCollection: {
            status: 'IN_PROGRESS',
            message: result.message,
          } satisfies InitialCollectionResult,
        };
      }

      return {
        ...saved,
        initialCollection: {
          status: result.errors > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
          received: result.received,
          created: result.created,
          updated: result.updated,
          duplicates: result.duplicates,
          errors: result.errors,
        } satisfies InitialCollectionResult,
      };
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Erreur inconnue lors de la collecte initiale.';
      this.logger.error(
        `La source ${saved.id} a été créée, mais sa collecte initiale a échoué : ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        ...saved,
        initialCollection: {
          status: 'FAILED',
          message,
        } satisfies InitialCollectionResult,
      };
    }
  }

  private connectorConfig(dto: CreateSourceDto): Record<string, unknown> {
    if (!dto.baseUrl) {
      throw new BadRequestException('Une URL est requise pour lancer la collecte.');
    }

    let url: URL;
    try {
      url = new URL(dto.baseUrl);
    } catch {
      throw new BadRequestException('L’URL de la source est invalide.');
    }

    if (
      !['http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
    ) {
      throw new BadRequestException('Utilisez une URL HTTP ou HTTPS sans identifiants.');
    }

    const query = dto.query?.trim() ?? '';
    if (dto.sourceType === 'RSS' || dto.sourceType === 'ATOM') {
      return { feedUrl: url.href, query };
    }

    if (url.hostname.toLowerCase() === 'api.crossref.org') {
      if (
        url.protocol !== 'https:'
        || url.hash
        || !/^\/(?:v1\/)?(?:$|works\/?$|(?:journals|members|funders|prefixes|types)\/[^/]+\/works\/?$)/.test(url.pathname)
      ) {
        throw new BadRequestException(
          'Utilisez une URL HTTPS de recherche Crossref, par exemple https://api.crossref.org/works.',
        );
      }

      return { provider: 'CROSSREF', baseUrl: url.href, query, rows: 10 };
    }

    if (url.hash) {
      throw new BadRequestException('Retirez le fragment (#...) de l’adresse API.');
    }
    return { provider: 'JSON_FEED', feedUrl: url.href, query };
  }

  findAll() {
    return this.sourceRepository.find({
      relations: {
        connectors: true,
      },

      order: {
        id: 'DESC',
      },
    });
  }

  async findOne(id: number) {
    const source = await this.sourceRepository.findOne({
      where: { id },

      relations: {
        connectors: true,
      },
    });

    if (!source) {
      throw new NotFoundException('Source introuvable');
    }

    return source;
  }

  async update(id: number, dto: UpdateSourceDto, actorId?: number) {
    const source = await this.findOne(id);
    const beforeValue = this.auditSnapshot(source);

    Object.assign(source, dto);

    const saved = await this.sourceRepository.save(source);
    await this.auditService.log({
      userId: actorId,
      action: 'UPDATE_SOURCE',
      entity: 'sources',
      entityId: saved.id,
      beforeValue,
      afterValue: this.auditSnapshot(saved),
    });
    return saved;
  }

  async setActive(id: number, active: boolean, actorId?: number) {
    const source = await this.findOne(id);
    const beforeValue = { active: source.active };

    source.active = active;

    const saved = await this.sourceRepository.save(source);
    await this.auditService.log({
      userId: actorId,
      action: active ? 'ACTIVATE_SOURCE' : 'DEACTIVATE_SOURCE',
      entity: 'sources',
      entityId: saved.id,
      beforeValue,
      afterValue: { active: saved.active },
    });
    return saved;
  }

  private auditSnapshot(source: Source) {
    return {
      name: source.name,
      organization: source.organization,
      country: source.country,
      category: source.category,
      sourceType: source.sourceType,
      baseUrl: source.baseUrl,
      frequency: source.frequency,
      active: source.active,
    };
  }
}
