import { Injectable, Logger } from '@nestjs/common';
import { NormalizedWatchItem } from '../watch-items/interfaces/normalized-watch-item.interface';

type DeepLTranslation = { text: string; detected_source_language?: string };
type DeepLResponse = { translations?: DeepLTranslation[] };

@Injectable()
export class DeepLService {
  private readonly logger = new Logger(DeepLService.name);
  private warnedMissingKey = false;
  private unavailableUntil = 0;
  private keyIndex = 0;

  private getApiKeys(): string[] {
    const values = [process.env.DEEPL_API_KEYS, process.env.DEEPL_API_KEY]
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean);
    return [...new Set(values)];
  }

  async translate(item: NormalizedWatchItem): Promise<NormalizedWatchItem> {
    const sourceItem: NormalizedWatchItem = {
      ...item,
      originalTitle: item.originalTitle ?? item.title,
      originalSummary: item.originalSummary ?? item.summary,
      originalLanguage: item.originalLanguage ?? item.language,
    };
    if (/^fr(?:-|$)/i.test(sourceItem.language ?? '')) {
      return { ...sourceItem, frenchTitle: sourceItem.title, frenchSummary: sourceItem.summary };
    }
    if (Date.now() < this.unavailableUntil) return sourceItem;

    const apiKeys = this.getApiKeys();
    const apiKey = apiKeys.length ? apiKeys[this.keyIndex++ % apiKeys.length] : '';
    if (!apiKey) {
      if (!this.warnedMissingKey) {
        this.logger.warn('DEEPL_API_KEY absente : les nouvelles veilles restent dans leur langue d’origine.');
        this.warnedMissingKey = true;
      }
      return sourceItem;
    }

    const texts = [sourceItem.title, sourceItem.summary].filter((value): value is string => Boolean(value?.trim()));
    if (!texts.length) return sourceItem;

    // Les clés API Free utilisent api-free ; les autres clés utilisent api.deepl.com.
    const endpoint = apiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: texts, target_lang: 'FR' }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) {
        // Une clé invalide ou un quota épuisé ne doit pas provoquer un appel par élément.
        if (response.status === 403 || response.status === 456) {
          this.unavailableUntil = Number.POSITIVE_INFINITY;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as DeepLResponse;
      const translations = data.translations;
      if (!Array.isArray(translations) || translations.length !== texts.length ||
        translations.some((translation) => typeof translation?.text !== 'string')) {
        throw new Error('Réponse de traduction incomplète');
      }

      const originalLanguage = translations[0].detected_source_language?.toLowerCase();
      return {
        ...sourceItem,
        title: originalLanguage === 'fr' ? sourceItem.title : translations[0].text,
        summary: sourceItem.summary
          ? translations[1]?.detected_source_language?.toLowerCase() === 'fr'
            ? sourceItem.summary
            : translations[1]?.text ?? sourceItem.summary
          : null,
        language: originalLanguage ?? item.language,
        originalLanguage: originalLanguage ?? sourceItem.originalLanguage,
        frenchTitle: originalLanguage === 'fr' ? sourceItem.title : translations[0].text,
        frenchSummary: sourceItem.summary
          ? (translations[1]?.detected_source_language?.toLowerCase() === 'fr'
            ? sourceItem.summary
            : translations[1]?.text ?? null)
          : null,
        // L'empreinte originale reste stable pour reconnaître les doublons.
      };
    } catch (error) {
      if (this.unavailableUntil !== Number.POSITIVE_INFINITY) {
        this.unavailableUntil = Date.now() + 60_000;
      }
      this.logger.warn(`Traduction DeepL indisponible : ${error instanceof Error ? error.message : 'erreur inconnue'}`);
      return sourceItem;
    }
  }

  async translateFrenchToEnglish(item: { title: string; summary: string | null }): Promise<{ title: string; summary: string | null }> {
    const apiKeys = this.getApiKeys();
    const apiKey = apiKeys.length ? apiKeys[this.keyIndex++ % apiKeys.length] : '';
    if (!apiKey) throw new Error('DEEPL_API_KEY ou DEEPL_API_KEYS absente.');
    const texts = [item.title, item.summary].filter((value): value is string => Boolean(value?.trim()));
    if (!texts.length) return item;
    const endpoint = apiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texts, source_lang: 'FR', target_lang: 'EN' }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`DeepL HTTP ${response.status}`);
    const data = await response.json() as DeepLResponse;
    if (!Array.isArray(data.translations) || data.translations.length !== texts.length ||
      data.translations.some((translation) => typeof translation?.text !== 'string')) {
      throw new Error('Réponse DeepL incomplète.');
    }
    let index = 0;
    const title = data.translations[index++].text;
    const summary = item.summary ? data.translations[index]?.text ?? item.summary : null;
    return { title, summary };
  }
}
