import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, LessThan, MoreThan, Repository } from 'typeorm';
import { NotificationMailService } from '../notifications/notification-mail.service';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import { RefreshSession } from './entities/refresh-session.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UserPasswordHistory } from './entities/user-password-history.entity';

const RESET_TTL_MS = 15 * 60 * 1000;
const REQUEST_MESSAGE = 'Si cette adresse existe dans notre système, un lien de réinitialisation a été envoyé.';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PasswordResetToken) private readonly tokens: Repository<PasswordResetToken>,
    private readonly database: DataSource,
    private readonly mail: NotificationMailService,
  ) {}

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async validateResetToken(token: string): Promise<{ valid: boolean }> {
    const reset = await this.tokens.findOne({
      where: {
        tokenHash: this.hash(token.toLowerCase()),
        expiresAt: MoreThan(new Date()),
      },
      select: { tokenHash: true },
    });
    return { valid: Boolean(reset) };
  }

  async forgotPassword(email: string) {
    const startedAt = Date.now();
    const user = await this.users.createQueryBuilder('user')
      .select(['user.id', 'user.email', 'user.status'])
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() })
      .getOne();

    if (user?.status === 'ACTIVE') {
      if (this.mail.isConfigured) {
        const token = randomBytes(32).toString('hex');
        const tokenHash = this.hash(token);
        await this.database.transaction(async (manager) => {
          await manager.getRepository(PasswordResetToken).delete({ userId: user.id });
          await manager.getRepository(PasswordResetToken).save({
            tokenHash,
            userId: user.id,
            expiresAt: new Date(Date.now() + RESET_TTL_MS),
          });
        });
        void this.deliverMail(user.email, token, tokenHash);
      } else {
        this.logger.error('Envoi de réinitialisation impossible : SMTP non configuré.');
      }
    }
    const remaining = 350 - (Date.now() - startedAt);
    if (remaining > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    }
    return { message: REQUEST_MESSAGE, accountExists: user?.status === 'ACTIVE' };
  }

  private async deliverMail(email: string, token: string, tokenHash: string) {
    try {
      await this.mail.sendPasswordReset(email, token);
    } catch (error) {
      try {
        await this.tokens.delete({ tokenHash });
      } catch (cleanupError) {
        this.logger.error('Nettoyage du lien non envoyé impossible.',
          cleanupError instanceof Error ? cleanupError.stack : String(cleanupError));
      }
      this.logger.error('Envoi du courriel de réinitialisation impossible.',
        error instanceof Error ? error.stack : String(error));
    }
  }

  async resetPassword(token: string, newPassword: string, ipAddress?: string) {
    if (Buffer.byteLength(newPassword, 'utf8') > 72) {
      throw new BadRequestException('Le mot de passe ne peut pas dépasser 72 octets.');
    }
    const tokenHash = this.hash(token.toLowerCase());

    const recipient = await this.database.transaction(async (manager) => {
      const reset = await manager.getRepository(PasswordResetToken).findOne({
        where: { tokenHash, expiresAt: MoreThan(new Date()) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!reset) throw new BadRequestException('Lien de réinitialisation invalide ou expiré.');

      const user = await manager.getRepository(User).findOne({
        where: { id: reset.userId, status: 'ACTIVE' },
        select: { id: true, email: true, passwordHash: true },
      });
      if (!user) throw new BadRequestException('Lien de réinitialisation invalide ou expiré.');

      const history = manager.getRepository(UserPasswordHistory);
      const previousPasswords = await history.find({
        where: { userId: user.id },
        select: { passwordHash: true },
      });
      for (const previous of previousPasswords) {
        if (await bcrypt.compare(newPassword, previous.passwordHash)) {
          throw new BadRequestException('Ce mot de passe a déjà été utilisé. Choisissez-en un autre.');
        }
      }
      if (await bcrypt.compare(newPassword, user.passwordHash)) {
        throw new BadRequestException('Ce mot de passe a déjà été utilisé. Choisissez-en un autre.');
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await history.save(history.create({ userId: user.id, passwordHash: user.passwordHash }));
      const updated = await manager.getRepository(User).update(
        { id: reset.userId, status: 'ACTIVE' }, { passwordHash },
      );
      if (updated.affected !== 1) {
        throw new BadRequestException('Lien de réinitialisation invalide ou expiré.');
      }
      await manager.getRepository(RefreshSession).delete({ user: { id: reset.userId } });
      await manager.getRepository(PasswordResetToken).delete({ tokenHash });
      await manager.getRepository(AuditLog).save({
        action: 'RESET_PASSWORD',
        entity: 'users',
        entityId: user.id,
        user: { id: user.id } as User,
        ipAddress: ipAddress ?? null,
      });
      return user.email;
    });
    try {
      await this.mail.sendPasswordChanged(recipient);
    } catch (error) {
      this.logger.error('Envoi du courriel de confirmation du changement de mot de passe impossible.',
        error instanceof Error ? error.stack : String(error));
    }
    return { message: 'Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.' };
  }

  @Interval(24 * 60 * 60 * 1000)
  async removeExpiredTokens() {
    await this.tokens.delete({ expiresAt: LessThan(new Date()) });
  }
}
