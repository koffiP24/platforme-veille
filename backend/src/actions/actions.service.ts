import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FollowUpAction } from './entities/follow-up-action.entity';
import { WatchItem } from '../watch-items/entities/watch-item.entity';
import { User } from '../users/entities/user.entity';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { WATCH_STATUS } from '../watch-items/constants/watch-status.constants';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(FollowUpAction)
    private readonly actionRepository: Repository<FollowUpAction>,
    @InjectRepository(WatchItem)
    private readonly itemRepository: Repository<WatchItem>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(itemId: number, dto: CreateActionDto, actor: { id: number; roles: string[] }) {
    const canAssignOthers = actor.roles.includes('ADMIN') ||
      actor.roles.includes('RESPONSABLE_VEILLE');
    if (!canAssignOthers && dto.ownerId !== actor.id) {
      throw new ForbiddenException('Vous ne pouvez créer que vos propres actions.');
    }
    const item = await this.itemRepository.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Élément de veille introuvable');
    const allowed = [
      WATCH_STATUS.TO_QUALIFY,
      WATCH_STATUS.VALIDATED,
      WATCH_STATUS.PUBLISHED,
    ];
    if (!allowed.includes(item.status as any))
      throw new ConflictException(
        'Impossible de créer une action pour cet élément dans son état actuel.',
      );
    const owner = await this.findAssignableOwner(dto.ownerId);
    const saved = await this.actionRepository.save(
      this.actionRepository.create({
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        actionType: dto.actionType,
        impact: dto.impact?.trim() || null,
        decision: null,
        dueDate: dto.dueDate ?? null,
        status: 'OPEN',
        progressComment: dto.progressComment?.trim() || null,
        result: dto.result?.trim() || null,
        startedAt: null,
        completedAt: null,
        watchItem: item,
        owner,
      }),
    );
    await this.auditService.log({
      userId: actor.id,
      action: 'CREATE_FOLLOW_UP_ACTION',
      entity: 'follow_up_actions',
      entityId: saved.id,
      afterValue: this.auditSnapshot(saved),
    });
    await this.notificationsService.notifyInApp(
      [owner.id],
      'Nouvelle action attribuée',
      `L’action « ${saved.title} » vous a été attribuée.`,
      item,
    );
    return saved;
  }

  findAll(currentUser: { id: number; roles: string[] }) {
    const canSeeAll =
      currentUser.roles.includes('ADMIN') ||
      currentUser.roles.includes('RESPONSABLE_VEILLE');

    return this.actionRepository.find({
      where: canSeeAll ? {} : { owner: { id: currentUser.id } },
      relations: { watchItem: true, owner: true },
      order: { createdAt: 'DESC' },
    });
  }
  findByItem(itemId: number, currentUser: { id: number; roles: string[] }) {
    const canSeeAll =
      currentUser.roles.includes('ADMIN') ||
      currentUser.roles.includes('RESPONSABLE_VEILLE');

    return this.actionRepository.find({
      where: canSeeAll
        ? { watchItem: { id: itemId } }
        : { watchItem: { id: itemId }, owner: { id: currentUser.id } },
      relations: { owner: true },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: number,
    dto: UpdateActionDto,
    currentUser: { id: number; roles: string[] },
  ) {
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: { watchItem: true, owner: true },
    });
    if (!action) throw new NotFoundException('Action introuvable');
    const privileged =
      currentUser.roles.includes('ADMIN') ||
      currentUser.roles.includes('RESPONSABLE_VEILLE');
    const isReferent = currentUser.roles.includes('REFERENT_LABORATOIRE');
    if (isReferent && !privileged && action.owner.id !== currentUser.id) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que les actions qui vous sont affectées.',
      );
    }
    const beforeValue = this.auditSnapshot(action);
    if (dto.title !== undefined) action.title = dto.title.trim();
    if (dto.description !== undefined)
      action.description = dto.description.trim() || null;
    if (dto.actionType !== undefined) action.actionType = dto.actionType;
    if (dto.ownerId !== undefined && dto.ownerId !== action.owner.id) {
      if (!privileged) {
        throw new ForbiddenException(
          'Seul un administrateur ou un responsable de veille peut réattribuer une action.',
        );
      }
      action.owner = await this.findAssignableOwner(dto.ownerId);
    }
    if (dto.status !== undefined) {
      action.status = dto.status;
      if (dto.status === 'IN_PROGRESS' && !action.startedAt) action.startedAt = new Date();
      if (dto.status === 'DONE' && !action.completedAt) action.completedAt = new Date();
    }
    if (dto.impact !== undefined) action.impact = dto.impact.trim() || null;
    if (dto.decision !== undefined)
      action.decision = dto.decision.trim() || null;
    if (dto.dueDate !== undefined) action.dueDate = dto.dueDate;
    if (dto.progressComment !== undefined) action.progressComment = dto.progressComment.trim() || null;
    if (dto.result !== undefined) action.result = dto.result.trim() || null;
    const saved = await this.actionRepository.save(action);
    if (dto.status === 'IN_PROGRESS') {
      const admins = await this.userRepository.find({ relations: { roles: true } });
      const adminIds = admins.filter((user) => user.status === 'ACTIVE' && user.roles.some((role) => role.name === 'ADMIN')).map((user) => user.id);
      await this.notificationsService.notifyInApp(
        adminIds,
        'Action démarrée',
        `L’action « ${saved.title} » a été démarrée par ${await this.userLabel(currentUser.id)}.`,
        saved.watchItem,
      );
    }
    if (dto.status === 'DONE') {
      const admins = await this.userRepository.find({ relations: { roles: true } });
      const adminIds = admins.filter((user) => user.status === 'ACTIVE' && user.roles.some((role) => role.name === 'ADMIN')).map((user) => user.id);
      await this.notificationsService.notifyInApp(
        [...adminIds, action.owner.id],
        'Action terminée',
        `L’action « ${saved.title} » est terminée.`,
        saved.watchItem,
      );
    }
    await this.auditService.log({
      userId: currentUser.id,
      action: 'UPDATE_FOLLOW_UP_ACTION',
      entity: 'follow_up_actions',
      entityId: saved.id,
      beforeValue,
      afterValue: this.auditSnapshot(saved),
    });
    return saved;
  }

  private async userLabel(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user ? `${user.firstName} ${user.lastName}`.trim() || user.email : 'Le responsable';
  }

  async countPendingForUser(userId: number) {
    const count = await this.actionRepository.count({
      where: {
        owner: { id: userId },
        status: In(['OPEN', 'IN_PROGRESS']),
      },
    });
    return { count };
  }

  @Interval(3_600_000)
  async notifyOverdueActions(referenceDate = new Date()) {
    const today = referenceDate.toISOString().slice(0, 10);
    const pendingActions = await this.actionRepository.find({
      where: { status: In(['OPEN', 'IN_PROGRESS']) },
      relations: { watchItem: true, owner: true },
    });
    const overdueActions = pendingActions.filter(
      (action) => Boolean(action.dueDate) && String(action.dueDate).slice(0, 10) < today,
    );
    if (!overdueActions.length) return { notifiedCount: 0 };

    const users = await this.userRepository.find({ relations: { roles: true } });
    const managerIds = users
      .filter(
        (user) =>
          user.status === 'ACTIVE' &&
          user.roles.some((role) => ['ADMIN', 'RESPONSABLE_VEILLE'].includes(role.name)),
      )
      .map((user) => user.id);

    let notifiedCount = 0;
    for (const action of overdueActions) {
      const dueStr = String(action.dueDate).slice(0, 10);
      const recipients = [
        ...new Set(
          [...managerIds, action.owner?.id].filter((id): id is number => Number.isInteger(id)),
        ),
      ];
      const created = await this.notificationsService.notifyInAppOnce(
        recipients,
        'Action en retard',
        `L’action « ${action.title} » a dépassé son échéance du ${dueStr}.`,
        action.watchItem,
      );
      if (created.length > 0) notifiedCount += 1;
    }
    return { notifiedCount };
  }

  async remove(
    id: number,
    currentUser: { id: number; roles: string[] },
  ) {
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: { watchItem: true, owner: true },
    });
    if (!action) throw new NotFoundException('Action introuvable');

    const privileged =
      currentUser.roles.includes('ADMIN') ||
      currentUser.roles.includes('RESPONSABLE_VEILLE');
    if (!privileged && action.owner.id !== currentUser.id) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que les actions qui vous sont affectées.',
      );
    }

    const beforeValue = this.auditSnapshot(action);
    await this.actionRepository.remove(action);
    await this.auditService.log({
      userId: currentUser.id,
      action: 'DELETE_FOLLOW_UP_ACTION',
      entity: 'follow_up_actions',
      entityId: id,
      beforeValue,
    });
    return { id, deleted: true };
  }

  private async findAssignableOwner(id: number) {
    const owner = await this.userRepository.findOne({ where: { id } });
    const allowedRoles = [
      'ADMIN',
      'RESPONSABLE_VEILLE',
      'REFERENT_LABORATOIRE',
    ];
    if (
      !owner ||
      owner.status !== 'ACTIVE' ||
      !owner.roles.some((role) => allowedRoles.includes(role.name))
    ) {
      throw new NotFoundException(
        'Le responsable doit être un utilisateur actif autorisé à exécuter des actions.',
      );
    }
    return owner;
  }

  private auditSnapshot(action: FollowUpAction) {
    const ownerName = action.owner
      ? `${action.owner.firstName} ${action.owner.lastName}`.trim() || action.owner.email
      : null;
    return {
      title: action.title,
      actionType: action.actionType,
      impact: action.impact,
      decision: action.decision,
      dueDate: action.dueDate,
      status: action.status,
      progressComment: action.progressComment,
      result: action.result,
      startedAt: action.startedAt,
      completedAt: action.completedAt,
      owner: ownerName,
      watchItem: action.watchItem?.title ?? null,
    };
  }
}
