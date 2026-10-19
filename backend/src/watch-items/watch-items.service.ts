import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Source } from '../sources/entities/source.entity';

import { WatchItem } from './entities/watch-item.entity';

import { WatchVersion } from './entities/watch-version.entity';

import { DeduplicationService } from './deduplication.service';

import { NormalizedWatchItem } from './interfaces/normalized-watch-item.interface';
import { AiAnalysisService } from '../ai/ai-analysis.service';

export type IngestionResult = 'CREE' | 'MIS_A_JOUR' | 'DOUBLON';

@Injectable()
export class WatchItemsService {
  constructor(
    @InjectRepository(WatchItem)
    private readonly watchItemRepository: Repository<WatchItem>,

    @InjectRepository(WatchVersion)
    private readonly versionRepository: Repository<WatchVersion>,

    private readonly deduplicationService: DeduplicationService,
    private readonly aiAnalysis: AiAnalysisService,
  ) {}

  async isUnchanged(normalized: NormalizedWatchItem): Promise<boolean> {
    const existing = await this.deduplicationService.findExisting(normalized);
    if (existing?.fingerprint !== normalized.fingerprint) return false;
    return Boolean(existing.originalTitle) &&
      (!normalized.summary || Boolean(existing.originalSummary));
  }

  async ingest(
    source: Source,
    normalized: NormalizedWatchItem,
  ): Promise<IngestionResult> {
    const existing = await this.deduplicationService.findExisting(normalized);

    if (!existing) {
      const watchItem = this.watchItemRepository.create({
        externalId: normalized.externalId,

        doi: normalized.doi,

        title: normalized.title,

        originalTitle: normalized.originalTitle ?? normalized.title,
        originalSummary: normalized.originalSummary ?? normalized.summary,
        originalLanguage: normalized.originalLanguage ?? normalized.language,
        frenchTitle: normalized.frenchTitle ?? null,
        frenchSummary: normalized.frenchSummary ?? null,

        summary: normalized.summary,

        url: normalized.url,

        canonicalUrl: normalized.canonicalUrl,

        publishedAt: normalized.publishedAt,

        collectedAt: normalized.collectedAt,

        language: normalized.language,

        watchType: normalized.watchType,

        status: normalized.status,

        fingerprint: normalized.fingerprint,

        source,
      });

      const saved = await this.watchItemRepository.save(watchItem);

      await this.createVersion(saved, normalized);
      this.aiAnalysis.scheduleAutomaticAnalysis(saved.id);

      return 'CREE';
    }

    if (existing.fingerprint === normalized.fingerprint) {
      if (!existing.originalTitle || (normalized.summary && !existing.originalSummary)) {
        existing.originalTitle = normalized.originalTitle ?? normalized.title;
        existing.originalSummary = normalized.originalSummary ?? normalized.summary;
        existing.originalLanguage = normalized.originalLanguage ?? normalized.language;
        existing.frenchTitle = normalized.frenchTitle ?? existing.frenchTitle;
        existing.frenchSummary = normalized.frenchSummary ?? existing.frenchSummary;
        existing.language = normalized.language ?? existing.language;
        const saved = await this.watchItemRepository.save(existing);
        await this.createVersion(saved, normalized);
        this.aiAnalysis.scheduleAutomaticAnalysis(saved.id);
        return 'MIS_A_JOUR';
      }
      return 'DOUBLON';
    }

    existing.externalId = normalized.externalId;

    existing.doi = normalized.doi;

    existing.title = normalized.title;

    existing.originalTitle = normalized.originalTitle ?? normalized.title;
    existing.originalSummary = normalized.originalSummary ?? normalized.summary;
    existing.originalLanguage = normalized.originalLanguage ?? normalized.language;
    existing.frenchTitle = normalized.frenchTitle ?? null;
    existing.frenchSummary = normalized.frenchSummary ?? null;

    existing.summary = normalized.summary;

    existing.url = normalized.url;

    existing.canonicalUrl = normalized.canonicalUrl;

    existing.publishedAt = normalized.publishedAt;

    existing.collectedAt = normalized.collectedAt;

    existing.language = normalized.language;

    existing.watchType = normalized.watchType;

    existing.fingerprint = normalized.fingerprint;
    existing.englishTitle = null;
    existing.englishSummary = null;

    const saved = await this.watchItemRepository.save(existing);

    await this.createVersion(saved, normalized);
    this.aiAnalysis.scheduleAutomaticAnalysis(saved.id);

    return 'MIS_A_JOUR';
  }

  private async createVersion(
    watchItem: WatchItem,
    normalized: NormalizedWatchItem,
  ) {
    const version = this.versionRepository.create({
      hash: normalized.fingerprint,

      payloadSnapshot: {
        externalId: normalized.externalId,

        doi: normalized.doi,

        title: normalized.title,

        originalTitle: normalized.originalTitle ?? null,
        originalSummary: normalized.originalSummary ?? null,
        originalLanguage: normalized.originalLanguage ?? normalized.language,
        frenchTitle: normalized.frenchTitle ?? null,
        frenchSummary: normalized.frenchSummary ?? null,

        summary: normalized.summary,

        url: normalized.url,

        canonicalUrl: normalized.canonicalUrl,

        publishedAt: normalized.publishedAt?.toISOString() ?? null,

        language: normalized.language,

        watchType: normalized.watchType,
      },

      watchItem,
    });

    await this.versionRepository.save(version);
  }

  findAll() {
    return this.watchItemRepository.find({
      relations: {
        source: true,
      },

      order: {
        collectedAt: 'DESC',
      },

      take: 100,
    });
  }

  async findOne(id: number) {
    const item = await this.watchItemRepository.findOne({
      where: { id },

      relations: {
        source: true,
        versions: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Élément de veille introuvable');
    }

    return item;
  }

  async saveEnglishTranslation(id: number, translation: { title: string; summary: string | null }) {
    const item = await this.findOne(id);
    item.englishTitle = translation.title;
    item.englishSummary = translation.summary;
    return this.watchItemRepository.save(item);
  }

  async findOneForRoles(id: number, roles: string[]) {
    const item = await this.findOne(id);
    const hasInternalRole = [
      'ADMIN',
      'RESPONSABLE_VEILLE',
      'REFERENT_LABORATOIRE',
      'OPERATEUR_VEILLE',
    ].some((role) => roles.includes(role));

    if (!hasInternalRole && item.status !== 'PUBLIE') {
      throw new NotFoundException('Élément de veille introuvable');
    }

    return item;
  }
}
