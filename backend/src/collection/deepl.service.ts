import { Injectable, Logger } from '@nestjs/common';
type DeepLTranslation = { text: string; detected_source_language?: string };
type DeepLResponse = { translations?: DeepLTranslation[] };
type TranslationInput = {
  title: string;
  summary: string | null;
  language: string | null;
  originalTitle?: string | null;
  originalSummary?: string | null;
  originalLanguage?: string | null;
  frenchTitle?: string | null;
  frenchSummary?: string | null;
};
type TranslationResult<T extends TranslationInput> = T & {
  originalTitle: string;
  originalSummary: string | null;
  originalLanguage: string | null;
  frenchTitle: string | null;
  frenchSummary: string | null;
};

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

  async translate<T extends TranslationInput>(item: T): Promise<TranslationResult<T>> {
    const sourceItem: TranslationResult<T> = {
      ...item,
      originalTitle: item.originalTitle ?? item.title,
      originalSummary: item.originalSummary ?? item.summary,
      originalLanguage: item.originalLanguage ?? item.language,
      frenchTitle: item.frenchTitle ?? null,
      frenchSummary: item.frenchSummary ?? null,
    };
    if (/^fr(?:-|$)/i.test(sourceItem.language ?? '')) {
      return { ...sourceItem, frenchTitle: sourceItem.title, frenchSummary: sourceItem.summary };
    }
    if (Date.now() < this.unavailableUntil) return sourceItem;

    const apiKeys = this.getApiKeys();
    if (!apiKeys.length) {
      if (!this.warnedMissingKey) {
        this.logger.warn('DEEPL_API_KEY absente : les nouvelles veilles restent dans leur langue d’origine.');
        this.warnedMissingKey = true;
      }
      return sourceItem;
    }

    const texts = [sourceItem.title, sourceItem.summary].filter((value): value is string => Boolean(value?.trim()));
    if (!texts.length) return sourceItem;

    const firstKeyIndex = this.keyIndex++ % apiKeys.length;
    let lastError: unknown = new Error('Aucune clé DeepL n’a pu effectuer la traduction.');
    let allKeysPermanentlyUnavailable = true;

    for (let offset = 0; offset < apiKeys.length; offset++) {
      const apiKey = apiKeys[(firstKeyIndex + offset) % apiKeys.length];
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
          lastError = new Error(`HTTP ${response.status}`);
          if (response.status !== 403 && response.status !== 456) {
            allKeysPermanentlyUnavailable = false;
          }
          continue;
        }

        const data = await response.json() as DeepLResponse;
        const translations = data.translations;
        if (!Array.isArray(translations) || translations.length !== texts.length ||
          translations.some((translation) => typeof translation?.text !== 'string')) {
          lastError = new Error('Réponse de traduction incomplète');
          allKeysPermanentlyUnavailable = false;
          continue;
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
        lastError = error;
        allKeysPermanentlyUnavailable = false;
      }
    }

    this.unavailableUntil = allKeysPermanentlyUnavailable
      ? Number.POSITIVE_INFINITY
      : Date.now() + 60_000;
    this.logger.warn(`Traduction DeepL indisponible avec ${apiKeys.length} clé(s) : ${lastError instanceof Error ? lastError.message : 'erreur inconnue'}`);
    return sourceItem;
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
