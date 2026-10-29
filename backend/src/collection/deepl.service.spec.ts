import { DeepLService } from './deepl.service';

describe('DeepLService', () => {
  const item = { title: 'Environmental standards', summary: 'New water rules', language: null, fingerprint: 'original' };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('traduit le titre et le résumé avec la clé API Free et conserve l’empreinte', async () => {
    vi.stubEnv('DEEPL_API_KEY', 'test-key:fx');
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translations: [
        { text: 'Normes environnementales', detected_source_language: 'EN' },
        { text: 'Nouvelles règles sur l’eau', detected_source_language: 'EN' },
      ] }),
    });
    vi.stubGlobal('fetch', request);

    const translated = await new DeepLService().translate(item as never);
    expect(translated).toMatchObject({
      title: 'Normes environnementales', summary: 'Nouvelles règles sur l’eau',
      language: 'en', fingerprint: 'original',
    });
    expect(request).toHaveBeenCalledWith('https://api-free.deepl.com/v2/translate', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'DeepL-Auth-Key test-key:fx' }),
      body: JSON.stringify({ text: [item.title, item.summary], target_lang: 'FR' }),
    }));
  });

  it('utilise l’endpoint standard pour une clé sans suffixe Free', async () => {
    vi.stubEnv('DEEPL_API_KEY', 'test-key');
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ translations: [
      { text: 'Normes environnementales', detected_source_language: 'EN' },
      { text: 'Nouvelles règles sur l’eau', detected_source_language: 'EN' },
    ] }) });
    vi.stubGlobal('fetch', request);
    await new DeepLService().translate(item as never);
    expect(request).toHaveBeenCalledWith('https://api.deepl.com/v2/translate', expect.any(Object));
  });

  it('essaie la clé suivante si la première est refusée ou à quota épuisé', async () => {
    vi.stubEnv('DEEPL_API_KEYS', 'first-key:fx,second-key:fx');
    const request = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 456 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ translations: [
        { text: 'Normes environnementales', detected_source_language: 'EN' },
        { text: 'Nouvelles règles sur l’eau', detected_source_language: 'EN' },
      ] }) });
    vi.stubGlobal('fetch', request);

    await expect(new DeepLService().translate(item as never)).resolves.toMatchObject({
      title: 'Normes environnementales',
      summary: 'Nouvelles règles sur l’eau',
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][1].headers.Authorization).toBe('DeepL-Auth-Key first-key:fx');
    expect(request.mock.calls[1][1].headers.Authorization).toBe('DeepL-Auth-Key second-key:fx');
  });

  it('garde le texte déjà français et évite un appel si sa langue est connue', async () => {
    vi.stubEnv('DEEPL_API_KEY', 'test-key:fx');
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(new DeepLService().translate({ ...item, language: 'fr-FR' } as never)).resolves.toMatchObject({ title: item.title });
    expect(request).not.toHaveBeenCalled();
  });

  it('conserve un titre détecté français même si le résumé est traduit', async () => {
    vi.stubEnv('DEEPL_API_KEY', 'test-key:fx');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ translations: [
      { text: 'Titre modifié', detected_source_language: 'FR' },
      { text: 'Résumé traduit', detected_source_language: 'EN' },
    ] }) }));
    await expect(new DeepLService().translate(item as never)).resolves.toMatchObject({ title: item.title, summary: 'Résumé traduit', language: 'fr' });
  });

  it('évite de répéter les appels lorsque le quota est épuisé', async () => {
    vi.stubEnv('DEEPL_API_KEY', 'test-key:fx');
    const request = vi.fn().mockResolvedValue({ ok: false, status: 456 });
    vi.stubGlobal('fetch', request);
    const service = new DeepLService();
    await service.translate(item as never);
    await service.translate(item as never);
    expect(request).toHaveBeenCalledOnce();
  });

  it('laisse le texte original si la clé est absente', async () => {
    vi.stubEnv('DEEPL_API_KEY', '');
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(new DeepLService().translate(item as never)).resolves.toMatchObject({
      title: item.title, summary: item.summary,
      originalTitle: item.title, originalSummary: item.summary,
    });
    expect(request).not.toHaveBeenCalled();
  });
});
