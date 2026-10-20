import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { DataSource, QueryRunner, Repository } from 'typeorm';

import { Connector } from '../connectors/entities/connector.entity';

import { ConnectorsService } from '../connectors/connectors.service';

import { WatchItemsService } from '../watch-items/watch-items.service';

import { NormalizationService } from './normalization.service';
import { DeepLService } from './deepl.service';

import { CollectionRun } from './entities/collection-run.entity';
import { AuditService } from '../audit/audit.service';
import { Source } from '../sources/entities/source.entity';
import { ExternalItem } from '../connectors/interfaces/connector.interface';
import ExcelJS from 'exceljs';
import { PDFParse } from 'pdf-parse';
import { extname } from 'path';

interface ManualImportFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  private readonly running = new Set<number>();

  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Connector)
    private readonly connectorRepository: Repository<Connector>,

    @InjectRepository(CollectionRun)
    private readonly runRepository: Repository<CollectionRun>,

    @InjectRepository(Source)
    private readonly sourceRepository: Repository<Source>,

    private readonly connectorsService: ConnectorsService,

    private readonly normalizationService: NormalizationService,

    private readonly translationService: DeepLService,

    private readonly watchItemsService: WatchItemsService,

    private readonly auditService: AuditService,
  ) {}

  async importManual(
    sourceId: number,
    file: ManualImportFile,
    userId?: number,
  ) {
    const source = await this.sourceRepository.findOne({
      where: { id: sourceId },
    });
    if (!source) throw new NotFoundException('Source introuvable');
    if (source.sourceType !== 'IMPORT_MANUEL') {
      throw new BadRequestException(
        'Cette source n’est pas configurée pour l’import manuel.',
      );
    }
    if (!source.active)
      throw new BadRequestException('Cette source est désactivée.');

    const extension = extname(file.originalname).toLowerCase();
    if (!['.csv', '.xlsx', '.pdf'].includes(extension)) {
      throw new BadRequestException('Formats acceptés : PDF, CSV et XLSX.');
    }
    const parsedRows = extension === '.xlsx'
      ? await this.readExcel(file.buffer)
      : extension === '.csv'
        ? this.readCsv(file.buffer)
        : await this.readPdf(file.buffer);
    if (!parsedRows.length)
      throw new BadRequestException('Le fichier ne contient aucune donnée.');
    if (parsedRows.length > 5000)
      throw new BadRequestException('Un import est limité à 5 000 lignes.');

    const run = await this.runRepository.save(
      this.runRepository.create({
        source,
        startedAt: new Date(),
        endedAt: null,
        status: 'RUNNING',
        receivedCount: parsedRows.length,
        newCount: 0,
        updatedCount: 0,
        duplicateCount: 0,
        errorCount: 0,
        errorMessage: null,
      }),
    );
    const rowErrors: string[] = [];

    for (let index = 0; index < parsedRows.length; index++) {
      try {
        const externalItem = this.toExternalItem(parsedRows[index], index + 2);
        const normalized = this.normalizationService.normalize(
          source,
          externalItem,
        );
        if (await this.watchItemsService.isUnchanged(normalized)) {
          run.duplicateCount++;
          continue;
        }
        const translated = await this.translationService.translate(normalized);
        const result = await this.watchItemsService.ingest(source, translated);
        if (result === 'CREE') run.newCount++;
        else if (result === 'MIS_A_JOUR') run.updatedCount++;
        else run.duplicateCount++;
      } catch (error) {
        run.errorCount++;
        if (rowErrors.length < 20) {
          rowErrors.push(
            error instanceof Error
              ? error.message
              : `Ligne ${index + 2} invalide.`,
          );
        }
      }
    }

    run.endedAt = new Date();
    run.status = run.errorCount ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
    run.errorMessage = rowErrors.length ? rowErrors.join(' | ') : null;
    await this.runRepository.save(run);

    const connector = await this.connectorRepository.findOne({
      where: { source: { id: source.id }, connectorType: 'IMPORT_MANUEL' },
      relations: { source: true },
    });
    if (connector) {
      connector.status =
        run.errorCount === parsedRows.length ? 'ERROR' : 'AVAILABLE';
      connector.lastSyncAt = run.endedAt;
      await this.connectorRepository.save(connector);
    }

    const result = {
      runId: run.id,
      source: source.name,
      received: run.receivedCount,
      created: run.newCount,
      updated: run.updatedCount,
      duplicates: run.duplicateCount,
      errors: run.errorCount,
      errorDetails: rowErrors,
    };
    await this.auditService.log({
      userId,
      action: 'IMPORT_MANUAL_ITEMS',
      entity: 'collection_runs',
      entityId: run.id,
      afterValue: {
        sourceId: source.id,
        fileName: file.originalname,
        ...result,
      },
    });
    return result;
  }

  private normalizeHeader(value: unknown) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private readCsv(buffer: Buffer): Array<Record<string, unknown>> {
    const content = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
    const delimiters = [';', ',', '\t'];
    const delimiter = delimiters.reduce(
      (best, candidate) =>
        firstLine.split(candidate).length > firstLine.split(best).length
          ? candidate
          : best,
      ';',
    );
    const rows: string[][] = [];
    let row: string[] = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < content.length; index++) {
      const char = content[index];
      if (char === '"') {
        if (quoted && content[index + 1] === '"') {
          value += '"';
          index++;
        } else quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(value);
        value = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && content[index + 1] === '\n') index++;
        row.push(value);
        value = '';
        if (row.some((cell) => cell.trim())) rows.push(row);
        row = [];
      } else value += char;
    }
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
    return this.rowsToObjects(rows);
  }

  private async readExcel(
    buffer: Buffer,
  ): Promise<Array<Record<string, unknown>>> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const rows: unknown[][] = [];
    sheet.eachRow({ includeEmpty: false }, (excelRow) => {
      const values: unknown[] = [];
      for (let index = 1; index <= excelRow.cellCount; index++) {
        const cell = excelRow.getCell(index);
        values.push(cell.value instanceof Date ? cell.value : cell.text);
      }
      rows.push(values);
    });
    return this.rowsToObjects(rows);
  }

  private async readPdf(buffer: Buffer): Promise<Array<Record<string, unknown>>> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const blocks = result.text
        .replace(/\u0000/g, '')
        .split(/\f|\n\s*\n+/)
        .map((block) => block.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^-- \d+ of \d+ --$/.test(line)))
        .filter((lines) => lines.length > 0);
      return blocks.map((lines, index) => {
        const title = lines[0];
        const urlIndex = lines.findIndex((line) => /^URL\s*:/i.test(line));
        const dateIndex = lines.findIndex((line) => /^Date\s*:/i.test(line));
        const summaryEnd = urlIndex >= 0 ? urlIndex : dateIndex >= 0 ? dateIndex : lines.length;
        const summary = lines.slice(1, summaryEnd).join(' ').trim();
        const url = urlIndex >= 0 ? lines[urlIndex].replace(/^URL\s*:\s*/i, '').trim() : '';
        const date = dateIndex >= 0 ? lines[dateIndex].replace(/^Date\s*:\s*/i, '').trim() : '';
        if (!title || (!summary && !url && !date)) {
          throw new BadRequestException(`Bloc PDF ${index + 1} : titre ou contenu introuvable.`);
        }
        return { titre: title, resume: summary, url, date_publication: date };
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Le PDF est illisible ou ne contient pas de texte exploitable.');
    } finally {
      await parser.destroy();
    }
  }

  private rowsToObjects(rows: unknown[][]) {
    if (rows.length < 2) return [];
    const headers = rows[0].map((value) => this.normalizeHeader(value));
    if (!headers.some((header) => ['titre', 'title'].includes(header))) {
      throw new BadRequestException(
        'Le fichier doit contenir une colonne « titre » ou « title ».',
      );
    }
    return rows
      .slice(1)
      .map((values) =>
        Object.fromEntries(
          headers.map((header, index) => [header, values[index] ?? '']),
        ),
      );
  }

  private pick(row: Record<string, unknown>, aliases: string[]) {
    for (const alias of aliases) {
      const value = row[alias];
      if (value !== undefined && value !== null && String(value).trim())
        return value;
    }
    return undefined;
  }

  private toExternalItem(
    row: Record<string, unknown>,
    line: number,
  ): ExternalItem {
    const title = String(this.pick(row, ['titre', 'title']) ?? '').trim();
    if (!title) throw new Error(`Ligne ${line} : le titre est obligatoire.`);
    const urlValue = this.pick(row, ['url', 'lien', 'link', 'adresse']);
    const url = urlValue ? String(urlValue).trim() : undefined;
    if (url) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error(`Ligne ${line} : le lien est invalide.`);
      }
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      ) {
        throw new Error(
          `Ligne ${line} : le lien doit être une adresse HTTP ou HTTPS valide.`,
        );
      }
    }
    const dateValue = this.pick(row, [
      'date_publication',
      'publication',
      'published_at',
      'publishedat',
      'date',
    ]);
    const publishedAt = this.parseImportDate(dateValue, line);
    return {
      externalId:
        String(
          this.pick(row, ['identifiant', 'external_id', 'externalid', 'id']) ??
            '',
        ).trim() || undefined,
      doi: String(this.pick(row, ['doi']) ?? '').trim() || undefined,
      title,
      summary:
        String(
          this.pick(row, ['resume', 'summary', 'description']) ?? '',
        ).trim() || undefined,
      url,
      publishedAt,
      language:
        String(this.pick(row, ['langue', 'language']) ?? '').trim() ||
        undefined,
      raw: row,
    };
  }

  private parseImportDate(value: unknown, line: number) {
    if (value === undefined || value === null || value === '') return undefined;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const raw = String(value).trim();
    const french = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const date = french
      ? new Date(
          Date.UTC(Number(french[3]), Number(french[2]) - 1, Number(french[1])),
        )
      : new Date(raw.length === 10 ? `${raw}T00:00:00.000Z` : raw);
    if (Number.isNaN(date.getTime()))
      throw new Error(`Ligne ${line} : la date de publication est invalide.`);
    return date;
  }

  async getActiveConnectors() {
    return this.connectorRepository.find({
      relations: {
        source: true,
      },

      where: {
        source: {
          active: true,
        },
      },
    });
  }

  async runConnector(
    connectorId: number,
    userId?: number,
    auditAction = 'RUN_COLLECTION',
  ) {
    if (this.running.has(connectorId)) {
      return {
        message: 'Une collecte est déjà en cours pour ce connecteur.',
      };
    }

    // Réserver le connecteur avant tout await pour bloquer les requêtes concurrentes.
    this.running.add(connectorId);

    let lockRunner: QueryRunner | null = null;
    let databaseLockAcquired = false;

    try {
      lockRunner = this.dataSource.createQueryRunner();
      await lockRunner.connect();

      const lockResult = (await lockRunner.query(
        'SELECT pg_try_advisory_lock($1, $2) AS acquired',
        [17025, connectorId],
      )) as Array<{ acquired: boolean }>;

      databaseLockAcquired = lockResult[0]?.acquired === true;

      if (!databaseLockAcquired) {
        return {
          message: 'Une collecte est déjà en cours pour ce connecteur.',
        };
      }

      try {
        const result = await this.executeCollection(connectorId);
        await this.auditService.log({
          userId,
          action: auditAction,
          entity: 'collection_runs',
          entityId: result.runId,
          afterValue: {
            connectorId,
            status: result.errors > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
            ...result,
          },
        });
        return result;
      } catch (error) {
        await this.auditService.log({
          userId,
          action: auditAction,
          entity: 'collection_runs',
          entityId: connectorId,
          afterValue: {
            connectorId,
            status: 'ERROR',
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          },
        });
        throw error;
      }
    } finally {
      if (lockRunner) {
        try {
          if (databaseLockAcquired) {
            await lockRunner.query('SELECT pg_advisory_unlock($1, $2)', [
              17025,
              connectorId,
            ]);
          }
        } finally {
          await lockRunner.release();
        }
      }

      this.running.delete(connectorId);
    }
  }

  async retryConnector(connectorId: number, userId?: number) {
    return this.runConnector(connectorId, userId, 'RETRY_COLLECTION');
  }

  private async executeCollection(connectorId: number) {
    const connector = await this.connectorRepository.findOne({
      where: {
        id: connectorId,
      },

      relations: {
        source: true,
      },
    });

    if (!connector) {
      throw new NotFoundException('Connecteur introuvable');
    }

    const run = this.runRepository.create({
      source: connector.source,

      startedAt: new Date(),

      endedAt: null,

      status: 'RUNNING',

      receivedCount: 0,
      filteredCount: 0,
      newCount: 0,
      updatedCount: 0,
      duplicateCount: 0,
      errorCount: 0,

      errorMessage: null,
    });

    await this.runRepository.save(run);

    try {
      const result = await this.connectorsService.collect(connectorId);

      run.receivedCount = result.receivedCount;

      run.filteredCount = result.ignoredCount;
      for (const externalItem of result.items) {
        try {
          const normalized = this.normalizationService.normalize(
            connector.source,
            externalItem,
          );

          if (await this.watchItemsService.isUnchanged(normalized)) {
            run.duplicateCount++;
            continue;
          }
          const translated = await this.translationService.translate(normalized);

          const ingestion = await this.watchItemsService.ingest(
            connector.source,
            translated,
          );

          switch (ingestion) {
            case 'CREE':
              run.newCount++;
              break;

            case 'MIS_A_JOUR':
              run.updatedCount++;
              break;

            case 'DOUBLON':
              run.duplicateCount++;
              break;
          }
        } catch (error) {
          run.errorCount++;

          this.logger.error(
            'Erreur lors du traitement d’un élément',
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      run.status = run.errorCount > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';

      run.endedAt = new Date();

      await this.runRepository.save(run);
      

      return {
        runId: run.id,

        source: connector.source.name,

        received: run.receivedCount,

        ignored: run.filteredCount,

        created: run.newCount,

        updated: run.updatedCount,

        duplicates: run.duplicateCount,

        errors: run.errorCount,
      };
    } catch (error) {
      run.status = 'ERROR';

      run.endedAt = new Date();

      run.errorCount++;

      run.errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';

      await this.runRepository.save(run);

      throw error;
    }
  }

  findRuns() {
    return this.runRepository.find({
      relations: {
        source: true,
      },

      order: {
        startedAt: 'DESC',
      },

      take: 100,
    });
  }
}
