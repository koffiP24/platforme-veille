import { SourcesService } from './sources.service';

function createService(overrides?: {
  createConnector?: ReturnType<typeof vi.fn>;
  runConnector?: ReturnType<typeof vi.fn>;
}) {
  const sourceRepository = {
    create: vi.fn((source) => source),
    save: vi.fn(async (source) => ({ ...source, id: 17 })),
  };
  const auditService = { log: vi.fn().mockResolvedValue(undefined) };
  const connectorsService = {
    create: overrides?.createConnector ?? vi.fn().mockResolvedValue({ id: 29 }),
  };
  const collectionService = {
    runConnector: overrides?.runConnector
      ?? vi.fn().mockResolvedValue({
        runId: 5,
        source: 'Test',
        received: 4,
        ignored: 0,
        created: 2,
        updated: 1,
        duplicates: 1,
        errors: 0,
      }),
  };

  return {
    service: new SourcesService(
      sourceRepository as never,
      auditService as never,
      connectorsService as never,
      collectionService as never,
    ),
    sourceRepository,
    auditService,
    connectorsService,
    collectionService,
  };
}

describe('SourcesService création et collecte initiale', () => {
  it('crée le connecteur et lance immédiatement la collecte d’une source RSS', async () => {
    const { service, connectorsService, collectionService } = createService();

    const source = await service.create({
      name: 'Flux de test',
      category: 'SCIENTIFIQUE',
      sourceType: 'RSS',
      baseUrl: 'https://example.org/feed.xml',
      query: 'laboratoire, analyse',
    }, 8);

    expect(connectorsService.create).toHaveBeenCalledWith({
      sourceId: 17,
      connectorType: 'RSS',
      config: {
        feedUrl: 'https://example.org/feed.xml',
        query: 'laboratoire, analyse',
      },
    });
    expect(collectionService.runConnector).toHaveBeenCalledWith(29, 8);
    expect(source).toMatchObject({
      id: 17,
      initialCollection: {
        status: 'COMPLETED',
        received: 4,
        created: 2,
        updated: 1,
        duplicates: 1,
        errors: 0,
      },
    });
  });

  it('ne lance pas de collecte automatique pour un import manuel', async () => {
    const { service, connectorsService, collectionService } = createService();

    const source = await service.create({
      name: 'Import manuel',
      category: 'AUTRE',
      sourceType: 'IMPORT_MANUEL',
    });

    expect(connectorsService.create).not.toHaveBeenCalled();
    expect(collectionService.runConnector).not.toHaveBeenCalled();
    expect(source).not.toHaveProperty('initialCollection');
  });

  it('renvoie explicitement l’échec de collecte sans masquer la source créée', async () => {
    const { service, collectionService } = createService({
      runConnector: vi.fn().mockRejectedValue(new Error('Flux inaccessible')),
    });

    const source = await service.create({
      name: 'Flux indisponible',
      category: 'SCIENTIFIQUE',
      sourceType: 'RSS',
      baseUrl: 'https://example.org/feed.xml',
    });

    expect(collectionService.runConnector).toHaveBeenCalledOnce();
    expect(source).toMatchObject({
      id: 17,
      initialCollection: {
        status: 'FAILED',
        message: 'Flux inaccessible',
      },
    });
  });
});
