import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';

import { AuditService } from '../audit/audit.service';
import { Role } from '../roles/entities/role.entity';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UserPasswordHistory } from '../auth/entities/user-password-history.entity';

describe('UsersService', () => {
  it('ne retourne comme assignables que les comptes actifs', async () => {
    const queryBuilder = {
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      distinct: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repository },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(UserPasswordHistory), useValue: {} },
        { provide: AuditService, useValue: { log: vi.fn() } },
      ],
    }).compile();

    await module.get(UsersService).findAssignable();
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'user.status = :status',
      { status: 'ACTIVE' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'role.name IN (:...roles)',
      {
        roles: ['ADMIN', 'RESPONSABLE_VEILLE', 'REFERENT_LABORATOIRE'],
      },
    );
  });
});
