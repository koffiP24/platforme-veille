import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { MoreThan } from 'typeorm';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshSession } from './entities/refresh-session.entity';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { UserPasswordHistory } from './entities/user-password-history.entity';
import * as bcrypt from 'bcrypt';

describe('PasswordResetService', () => {
  const user = { id: 7, email: 'lecteur@veille.local', status: 'ACTIVE' };
  const query = { select: vi.fn(), where: vi.fn(), getOne: vi.fn() };
  query.select.mockReturnValue(query);
  query.where.mockReturnValue(query);
  const users = { createQueryBuilder: vi.fn(() => query) };
  const tokens = { delete: vi.fn().mockResolvedValue({ affected: 1 }) };
  const resetRepo = {
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    save: vi.fn().mockResolvedValue(undefined),
    findOne: vi.fn(),
  };
  const userRepo = {
    findOne: vi.fn().mockResolvedValue(user),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const sessionRepo = { delete: vi.fn().mockResolvedValue({ affected: 1 }) };
  const auditRepo = { save: vi.fn().mockResolvedValue(undefined) };
  const historyRepo = {
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn((value) => value),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const manager = {
    getRepository: vi.fn((entity) => entity === PasswordResetToken ? resetRepo :
      entity === RefreshSession ? sessionRepo : entity === AuditLog ? auditRepo :
        entity === UserPasswordHistory ? historyRepo : userRepo),
  };
  const database = { transaction: vi.fn((work) => work(manager)) };
  const mail = {
    isConfigured: true,
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
    sendPasswordChanged: vi.fn().mockResolvedValue(undefined),
  };
  const service = new PasswordResetService(users as never, tokens as never,
    database as never, mail as never);

  beforeEach(async () => {
    vi.clearAllMocks();
    query.getOne.mockResolvedValue(user);
    resetRepo.findOne.mockResolvedValue(null);
    userRepo.findOne.mockResolvedValue({ ...user, passwordHash: await bcrypt.hash('CurrentPassword123!', 4) });
    userRepo.update.mockResolvedValue({ affected: 1 });
  });

  it('donne la même réponse pour un compte inconnu et n’envoie aucun lien', async () => {
    query.getOne.mockResolvedValue(null);
    const unknown = await service.forgotPassword('absent@example.org');
    query.getOne.mockResolvedValue(user);
    const known = await service.forgotPassword(user.email);
    expect(unknown).toEqual(known);
    expect(mail.sendPasswordReset).toHaveBeenCalledOnce();
    expect(resetRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: user.id,
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expect.any(Date),
    }));
  });

  it('refuse un lien absent ou expiré', async () => {
    await expect(service.resetPassword('a'.repeat(64), 'MotDePasseFort123!'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(mail.sendPasswordChanged).not.toHaveBeenCalled();
    expect(auditRepo.save).not.toHaveBeenCalled();
  });

  it('garde une réponse neutre si le courriel échoue et supprime le lien inutilisable', async () => {
    mail.sendPasswordReset.mockRejectedValueOnce(new Error('SMTP indisponible'));
    const result = await service.forgotPassword(user.email);
    expect(result.message).toContain('Si cette adresse existe');
    expect(tokens.delete).toHaveBeenCalledWith({ tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
  });

  it('consomme le lien une seule fois et révoque les sessions', async () => {
    const token = 'b'.repeat(64);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    resetRepo.findOne.mockResolvedValueOnce({ tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 60_000) });
    await service.resetPassword(token, 'MotDePasseFort123!');
    expect(resetRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash, expiresAt: MoreThan(expect.any(Date)) },
      lock: { mode: 'pessimistic_write' },
    }));
    expect(userRepo.update).toHaveBeenCalledWith({ id: user.id, status: 'ACTIVE' },
      { passwordHash: expect.any(String) });
    expect(sessionRepo.delete).toHaveBeenCalledWith({ user: { id: user.id } });
    expect(resetRepo.delete).toHaveBeenCalledWith({ tokenHash });
    expect(auditRepo.save).toHaveBeenCalledExactlyOnceWith({
      action: 'RESET_PASSWORD',
      entity: 'users',
      entityId: user.id,
      user,
      ipAddress: null,
    });
    expect(mail.sendPasswordChanged).toHaveBeenCalledExactlyOnceWith(user.email);
    await expect(service.resetPassword(token, 'MotDePasseFort123!'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(mail.sendPasswordChanged).toHaveBeenCalledTimes(1);
    expect(auditRepo.save).toHaveBeenCalledTimes(1);
  });

  it('conserve le mot de passe modifié si le courriel de confirmation échoue', async () => {
    resetRepo.findOne.mockResolvedValueOnce({ userId: user.id });
    mail.sendPasswordChanged.mockRejectedValueOnce(new Error('SMTP indisponible'));
    await expect(service.resetPassword('c'.repeat(64), 'MotDePasseFort123!'))
      .resolves.toEqual({ message: 'Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.' });
    expect(userRepo.update).toHaveBeenCalledOnce();
    expect(mail.sendPasswordChanged).toHaveBeenCalledWith(user.email);
  });

  it('ne confirme pas la réinitialisation si le journal d’audit échoue', async () => {
    resetRepo.findOne.mockResolvedValueOnce({ userId: user.id });
    auditRepo.save.mockRejectedValueOnce(new Error('Journal indisponible'));
    await expect(service.resetPassword('d'.repeat(64), 'MotDePasseFort123!'))
      .rejects.toThrow('Journal indisponible');
    expect(mail.sendPasswordChanged).not.toHaveBeenCalled();
  });
});
