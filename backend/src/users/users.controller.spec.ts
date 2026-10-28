import { Test } from '@nestjs/testing';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  it('retourne les utilisateurs fournis par le service', async () => {
    const users = [{ id: 1, email: 'admin@veille.local', firstName: 'Admin', lastName: 'Sys', status: 'ACTIVE', roles: [{ id: 1, name: 'ADMIN', description: 'Admin' }] }];
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: { findAll: () => users } }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    await expect(module.get(UsersController).findAll()).resolves.toEqual([
      {
        id: 1,
        email: 'admin@veille.local',
        firstName: 'Admin',
        lastName: 'Sys',
        status: 'ACTIVE',
        mustChangePassword: false,
        lastLoginAt: undefined,
        roles: [{ id: 1, name: 'ADMIN', description: 'Admin' }],
      },
    ]);
  });
});
