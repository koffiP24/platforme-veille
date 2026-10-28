import { createHash } from 'node:crypto';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RefreshSession } from './entities/refresh-session.entity';
import { UserPasswordHistory } from './entities/user-password-history.entity';
import { AuditService } from '../audit/audit.service';

describe('AuthService', () => {
  const user = {
    id: 1, firstName: 'Admin', lastName: 'Plateforme',
    email: 'admin@veille.local', status: 'ACTIVE', mustChangePassword: true, roles: [{ name: 'ADMIN' }],
  };
  const usersService = {
    findByEmailWithPassword: vi.fn(),
    updateLastLogin: vi.fn(),
    findById: vi.fn(),
    saveUser: vi.fn(),
  };
  const jwtService = {
    signAsync: vi.fn(async (payload: { type: string }) => payload.type === 'access'
      ? 'access-test' : 'refresh-test'),
    verifyAsync: vi.fn(),
  };
  const sessions = {
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => value),
    findOne: vi.fn(),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const passwordHistory = {
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn((value) => value),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const config = {
    get: vi.fn((key: string) => ({
      JWT_EXPIRES_IN: '8h',
      JWT_REFRESH_EXPIRES_IN: '7d',
    })[key]),
    getOrThrow: vi.fn((key: string) => ({
      JWT_SECRET: 'access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
    })[key]),
  };
  const auditService = {
    log: vi.fn(),
  };
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    sessions.update.mockResolvedValue({ affected: 1 });
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
        { provide: AuditService, useValue: auditService },
        { provide: getRepositoryToken(RefreshSession), useValue: sessions },
        { provide: getRepositoryToken(UserPasswordHistory), useValue: passwordHistory },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('refuse un compte inconnu', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(null);
    await expect(service.login({ email: user.email, password: 'incorrect' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('crée une session renouvelable après connexion et transmet mustChangePassword', async () => {
    const passwordHash = await bcrypt.hash('MotDePasse1!', 4);
    usersService.findByEmailWithPassword.mockResolvedValue({ ...user, passwordHash });
    const result = await service.login({ email: user.email, password: 'MotDePasse1!' });

    expect(result.accessToken).toBe('access-test');
    expect(result.refreshToken).toBe('refresh-test');
    expect(result.user.roles).toEqual(['ADMIN']);
    expect(result.user.mustChangePassword).toBe(true);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'access', mustChangePassword: true }),
      expect.objectContaining({ expiresIn: 28800 }),
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'refresh', jti: expect.any(String) }),
      expect.objectContaining({ secret: 'refresh-secret', expiresIn: 604800 }),
    );
    expect(sessions.save).toHaveBeenCalledWith(expect.objectContaining({
      tokenHash: createHash('sha256').update('refresh-test').digest('hex'),
    }));
    expect(usersService.updateLastLogin).toHaveBeenCalledWith(1);
  });

  it('renouvelle et remplace le jeton de rafraîchissement une seule fois', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 1, jti: 'old-id', type: 'refresh' });
    sessions.findOne.mockResolvedValue({
      id: 'old-id',
      tokenHash: createHash('sha256').update('old-refresh').digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });
    const result = await service.refresh('old-refresh');
    expect(result.accessToken).toBe('access-test');
    expect(sessions.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'old-id' }),
      expect.objectContaining({ id: expect.any(String), tokenHash: expect.any(String) }),
    );

    sessions.update.mockResolvedValueOnce({ affected: 0 });
    await expect(service.refresh('old-refresh')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse une session expirée ou un compte désactivé', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 1, jti: 'old-id', type: 'refresh' });
    sessions.findOne.mockResolvedValue({
      id: 'old-id', expiresAt: new Date(Date.now() - 1), user,
    });
    await expect(service.refresh('old-refresh')).rejects.toBeInstanceOf(UnauthorizedException);
    sessions.findOne.mockResolvedValue({
      id: 'old-id', expiresAt: new Date(Date.now() + 60_000),
      user: { ...user, status: 'INACTIVE' },
    });
    await expect(service.refresh('old-refresh')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('révoque le jeton de rafraîchissement à la déconnexion', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 1, jti: 'old-id', type: 'refresh' });
    await service.logout('old-refresh');
    expect(sessions.delete).toHaveBeenCalledWith({
      id: 'old-id',
      tokenHash: createHash('sha256').update('old-refresh').digest('hex'),
    });
  });

  it('permet de changer de mot de passe et réinitialise mustChangePassword à false', async () => {
    const passwordHash = await bcrypt.hash('TempPassword123!', 4);
    const userToUpdate = { ...user, passwordHash, mustChangePassword: true };
    usersService.findById.mockResolvedValue(userToUpdate);
    usersService.findByEmailWithPassword.mockResolvedValue(userToUpdate);
    usersService.saveUser.mockImplementation(async (u) => u);

    const result = await service.changePassword(user.id, {
      currentPassword: 'TempPassword123!',
      newPassword: 'NewSecurePassword123!',
    });

    expect(result.user.mustChangePassword).toBe(false);
    expect(usersService.saveUser).toHaveBeenCalledWith(expect.objectContaining({
      mustChangePassword: false,
    }));
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CHANGE_PASSWORD',
      entityId: user.id,
    }));
  });

  it('refuse la réutilisation d’un ancien mot de passe', async () => {
    const currentHash = await bcrypt.hash('TempPassword123!', 4);
    const previousHash = await bcrypt.hash('ReusedPassword123!', 4);
    const userToUpdate = { ...user, passwordHash: currentHash, mustChangePassword: true };
    usersService.findById.mockResolvedValue(userToUpdate);
    usersService.findByEmailWithPassword.mockResolvedValue(userToUpdate);
    passwordHistory.find.mockResolvedValueOnce([{ passwordHash: previousHash }]);

    await expect(service.changePassword(user.id, {
      currentPassword: 'TempPassword123!',
      newPassword: 'ReusedPassword123!',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(usersService.saveUser).not.toHaveBeenCalled();
  });

  it('refuse le changement si le mot de passe actuel est erroné', async () => {
    const passwordHash = await bcrypt.hash('TempPassword123!', 4);
    const userToUpdate = { ...user, passwordHash, mustChangePassword: true };
    usersService.findById.mockResolvedValue(userToUpdate);
    usersService.findByEmailWithPassword.mockResolvedValue(userToUpdate);

    await expect(service.changePassword(user.id, {
      currentPassword: 'WrongPassword!',
      newPassword: 'NewSecurePassword123!',
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
