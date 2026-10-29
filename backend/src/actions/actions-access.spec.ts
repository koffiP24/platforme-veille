import { ForbiddenException } from '@nestjs/common';
import { ActionsService } from './actions.service';

describe('ActionsService - accès et alertes des actions', () => {
  it('refuse à un référent de créer une action pour un autre utilisateur', async () => {
    const itemRepository = { findOne: vi.fn() };
    const service = new ActionsService(
      { save: vi.fn() } as never,
      itemRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.create(12, {
      title: 'Analyse', actionType: 'ANALYSE_IMPACT', ownerId: 9,
    }, { id: 3, roles: ['REFERENT_LABORATOIRE'] }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(itemRepository.findOne).not.toHaveBeenCalled();
  });

  it('notifie le responsable et les administrateurs pour les actions en retard non clôturées', async () => {
    const actionRepository = {
      find: vi.fn().mockResolvedValue([
        {
          id: 1,
          title: 'Réviser procédure étalonnage',
          status: 'OPEN',
          dueDate: '2026-10-15',
          owner: { id: 7 },
          watchItem: { id: 42, title: 'Norme ISO 17025' },
        },
        {
          id: 2,
          title: 'Action future',
          status: 'IN_PROGRESS',
          dueDate: '2026-11-20',
          owner: { id: 7 },
          watchItem: { id: 43, title: 'Autre veille' },
        },
      ]),
    };
    const userRepository = {
      find: vi.fn().mockResolvedValue([
        { id: 1, status: 'ACTIVE', roles: [{ name: 'ADMIN' }] },
        { id: 2, status: 'ACTIVE', roles: [{ name: 'RESPONSABLE_VEILLE' }] },
        { id: 9, status: 'INACTIVE', roles: [{ name: 'ADMIN' }] },
      ]),
    };
    const notificationsService = {
      notifyInAppOnce: vi.fn().mockResolvedValue([{ id: 100 }]),
    };

    const service = new ActionsService(
      actionRepository as never,
      {} as never,
      userRepository as never,
      {} as never,
      notificationsService as never,
    );

    const result = await service.notifyOverdueActions(new Date('2026-10-29T10:00:00Z'));

    expect(result).toEqual({ notifiedCount: 1 });
    expect(notificationsService.notifyInAppOnce).toHaveBeenCalledTimes(1);
    expect(notificationsService.notifyInAppOnce).toHaveBeenCalledWith(
      [1, 2, 7],
      'Action en retard',
      'L’action « Réviser procédure étalonnage » a dépassé son échéance du 2026-10-15.',
      { id: 42, title: 'Norme ISO 17025' },
    );
  });
});
