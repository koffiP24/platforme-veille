import { AuditService } from './audit.service';
import { AuditQueryDto } from './audit-query.dto';

describe('AuditService', () => {
  const repository = {
    count: vi.fn(),
    find: vi.fn(),
  };
  const dataSource = { query: vi.fn() };
  const service = new AuditService(repository as never, {} as never, dataSource as never);

  beforeEach(() => {
    vi.clearAllMocks();
    repository.count.mockResolvedValue(43);
    repository.find.mockResolvedValue([]);
  });

  it('renvoie la première page avec le total des opérations visibles', async () => {
    await expect(service.list(new AuditQueryDto())).resolves.toMatchObject({
      items: [], total: 43, page: 0, limit: 20, capped: false,
    });
    expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
  });

  it('filtre le décompte et les résultats selon le groupe demandé', async () => {
    const query = Object.assign(new AuditQueryDto(), { page: 1, limit: 10, group: 'users' as const });
    await service.list(query);
    expect(repository.count).toHaveBeenCalledWith({ where: { entity: expect.anything() } });
    expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { entity: expect.anything() }, skip: 10, take: 10,
    }));
  });

  it('borne les opérations visibles et le total à 500', async () => {
    repository.count.mockResolvedValue(742);
    const query = Object.assign(new AuditQueryDto(), { page: 50, limit: 20 });
    await expect(service.list(query)).resolves.toMatchObject({
      total: 500, page: 24, limit: 20, capped: true,
    });
    expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({ skip: 480, take: 20 }));
  });
});
