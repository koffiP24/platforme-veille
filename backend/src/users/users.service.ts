import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';

import { Role } from '../roles/entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { UserPasswordHistory } from '../auth/entities/user-password-history.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserPasswordHistory)
    private readonly passwordHistory: Repository<UserPasswordHistory>,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.userRepository.find({
      order: {
        id: 'DESC',
      },
    });
  }

  findAssignable() {
    return this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .select(['user.id', 'user.firstName', 'user.lastName', 'user.email'])
      .where('user.status = :status', { status: 'ACTIVE' })
      .andWhere('role.name IN (:...roles)', {
        roles: ['ADMIN', 'RESPONSABLE_VEILLE', 'REFERENT_LABORATOIRE'],
      })
      .distinct(true)
      .orderBy('user.firstName', 'ASC')
      .addOrderBy('user.lastName', 'ASC')
      .getMany();
  }

  async findById(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    return user;
  }

  async findByEmailWithPassword(email: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.roles', 'roles')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  generateTemporaryPassword(length = 16): string {
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const specials = '!@#$%&*?';
    const all = uppers + lowers + digits + specials;

    const chars = [
      uppers[crypto.randomInt(uppers.length)],
      lowers[crypto.randomInt(lowers.length)],
      digits[crypto.randomInt(digits.length)],
      specials[crypto.randomInt(specials.length)],
    ];

    while (chars.length < length) {
      chars.push(all[crypto.randomInt(all.length)]);
    }

    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
  }

  async create(dto: CreateUserDto, actorId?: number): Promise<{ user: User; temporaryPassword?: string }> {
    const existing = await this.userRepository.findOne({
      where: {
        email: dto.email.toLowerCase(),
      },
    });

    if (existing) {
      throw new BadRequestException('Cette adresse email existe déjà');
    }

    const roles = await this.roleRepository.find({
      where: {
        name: In(dto.roles),
      },
    });

    if (roles.length !== dto.roles.length) {
      throw new BadRequestException('Un ou plusieurs rôles sont invalides');
    }

    let finalPassword = dto.password;
    let temporaryPassword: string | undefined;
    let mustChangePassword = false;

    if (!finalPassword || dto.temporaryPassword) {
      temporaryPassword = this.generateTemporaryPassword(16);
      finalPassword = temporaryPassword;
      mustChangePassword = true;
    }

    const passwordHash = await bcrypt.hash(finalPassword, 12);

    const user = this.userRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email.toLowerCase(),
      passwordHash,
      status: 'ACTIVE',
      mustChangePassword,
      roles,
    });

    const saved = await this.userRepository.save(user);
    await this.auditService.log({
      userId: actorId,
      action: 'CREATE_USER',
      entity: 'users',
      entityId: saved.id,
      afterValue: this.auditSnapshot(saved),
    });
    return { user: saved, temporaryPassword };
  }

  async resetToTemporaryPassword(id: number, actorId: number): Promise<{ temporaryPassword: string }> {
    const user = await this.findById(id);
    const userWithPassword = await this.findByEmailWithPassword(user.email);
    if (!userWithPassword) throw new NotFoundException('Utilisateur introuvable');
    const temporaryPassword = this.generateTemporaryPassword(16);
    await this.passwordHistory.save(this.passwordHistory.create({
      userId: userWithPassword.id,
      passwordHash: userWithPassword.passwordHash,
    }));
    userWithPassword.passwordHash = await bcrypt.hash(temporaryPassword, 12);
    userWithPassword.mustChangePassword = true;

    await this.userRepository.save(userWithPassword);

    await this.auditService.log({
      userId: actorId,
      action: 'RESET_USER_PASSWORD_TEMPORARY',
      entity: 'users',
      entityId: userWithPassword.id,
      afterValue: { mustChangePassword: true },
    });

    return { temporaryPassword };
  }

  async saveUser(user: User): Promise<User> {
    return this.userRepository.save(user);
  }

  async updateLastLogin(id: number) {
    await this.userRepository.update(id, {
      lastLoginAt: new Date(),
    });
  }

  async setStatus(id: number, status: 'ACTIVE' | 'INACTIVE', actorId: number) {
    if (id === actorId && status === 'INACTIVE') {
      throw new BadRequestException(
        'Vous ne pouvez pas désactiver votre propre compte.',
      );
    }

    const user = await this.findById(id);
    const beforeValue = { status: user.status };
    user.status = status;
    await this.userRepository.save(user);

    await this.auditService.log({
      userId: actorId,
      action: status === 'ACTIVE' ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entity: 'users',
      entityId: user.id,
      beforeValue,
      afterValue: { status: user.status },
    });

    return { id: user.id, status: user.status };
  }

  async setRoles(id: number, roleNames: string[], actorId: number) {
    if (id === actorId && !roleNames.includes('ADMIN')) {
      throw new BadRequestException(
        'Vous ne pouvez pas retirer votre propre rôle Administrateur.',
      );
    }

    const user = await this.findById(id);
    const beforeValue = {
      roles: user.roles.map((role) => role.name),
    };
    const uniqueRoleNames = [...new Set(roleNames)];
    const roles = await this.roleRepository.find({
      where: { name: In(uniqueRoleNames) },
      order: { name: 'ASC' },
    });

    if (roles.length !== uniqueRoleNames.length) {
      throw new BadRequestException('Un ou plusieurs rôles sont invalides.');
    }

    user.roles = roles;
    await this.userRepository.save(user);

    await this.auditService.log({
      userId: actorId,
      action: 'UPDATE_USER_ROLES',
      entity: 'users',
      entityId: user.id,
      beforeValue,
      afterValue: { roles: roles.map((role) => role.name) },
    });

    return {
      id: user.id,
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
      })),
    };
  }

  private auditSnapshot(user: User) {
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      roles: user.roles?.map((role) => role.name) ?? [],
    };
  }
}
