import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { WatchItem } from '../watch-items/entities/watch-item.entity';
import { WatchItemPublishedEvent } from './events/watch-item-published.event';
import { NotificationMailService } from './notification-mail.service';
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly sendingIds = new Set<number>();

  constructor(
    @InjectRepository(Notification) private repo: Repository<Notification>,
    @InjectRepository(Subscription) private subs: Repository<Subscription>,
    @InjectRepository(WatchItem) private items: Repository<WatchItem>,
    private readonly mail: NotificationMailService,
  ) {}

  @OnEvent('watch-item.published') async onPublished(
    e: WatchItemPublishedEvent,
  ) {
    const item = await this.items.findOne({
      where: { id: e.watchItemId },
      relations: {
        source: true,
        domains: true,
        topicLinks: { topic: true },
        keywordLinks: { keyword: true },
      },
    });
    if (!item) return;
    const all = await this.subs.find({
      where: { active: true },
      relations: {
        user: true,
        source: true,
        domain: true,
        topic: true,
        keyword: true,
      },
    });
    const recipients = new Map<string, Subscription>();
    for (const s of all) {
      const match =
        (s.subscriptionType === 'SOURCE' && s.source?.id === item.source.id) ||
        (s.subscriptionType === 'DOMAIN' &&
          item.domains.some((d) => d.id === s.domain?.id)) ||
        (s.subscriptionType === 'TOPIC' &&
          item.topicLinks?.some((l) => l.topic.id === s.topic?.id)) ||
        (s.subscriptionType === 'KEYWORD' &&
          item.keywordLinks?.some((l) => l.keyword.id === s.keyword?.id));
      if (match && s.user?.id) {
        recipients.set(`${s.user.id}:${s.channel}`, s);
      }
    }

    for (const s of recipients.values()) {
      const isEmail = s.channel === 'EMAIL';
      const notification = await this.repo.save(
        this.repo.create({
          title: 'Nouvelle veille publiée',
          message: item.title,
          channel: s.channel,
          status: isEmail ? 'PENDING' : 'SENT',
          sentAt: isEmail ? null : new Date(),
          readAt: null,
          user: s.user,
          watchItem: item,
        }),
      );

      if (isEmail && this.mail.isConfigured) {
        await this.deliverEmail(notification, item);
      }
    }
  }

  @Interval(60_000)
  async sendPendingEmails(): Promise<void> {
    if (!this.mail.isConfigured) return;
    const pending = await this.repo.find({
      where: { channel: 'EMAIL', status: 'PENDING' },
      relations: { user: true, watchItem: { source: true } },
      take: 50,
      order: { createdAt: 'ASC' },
    });
    for (const notification of pending) {
      if (!notification.watchItem) {
        notification.status = 'FAILED';
        await this.repo.save(notification);
        continue;
      }
      await this.deliverEmail(notification, notification.watchItem);
    }
  }

  private async deliverEmail(notification: Notification, item: WatchItem): Promise<void> {
    if (this.sendingIds.has(notification.id)) return;
    this.sendingIds.add(notification.id);
    try {
      await this.mail.sendPublication(notification.user.email, item);
      notification.status = 'SENT';
      notification.sentAt = new Date();
    } catch (error) {
      notification.status = 'FAILED';
      this.logger.error(
        `Envoi de l'alerte e-mail ${notification.id} impossible : ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await this.repo.save(notification);
      this.sendingIds.delete(notification.id);
    }
  }
  list(userId: number) {
    return this.repo.find({
      where: { user: { id: userId } },
      relations: { watchItem: true },
      order: { createdAt: 'DESC' },
    });
  }

  async notifyInApp(userIds: number[], title: string, message: string, watchItem?: WatchItem | null) {
    const uniqueIds = [...new Set(userIds.filter((id) => Number.isInteger(id)))];
    if (!uniqueIds.length) return [];
    return this.repo.save(uniqueIds.map((userId) => this.repo.create({
      title,
      message,
      channel: 'IN_APP',
      status: 'SENT',
      sentAt: new Date(),
      readAt: null,
      user: { id: userId } as any,
      watchItem: watchItem ?? null,
    })));
  }
  async markAllRead(userId: number) {
    const result = await this.repo.createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('read_at IS NULL')
      .execute();
    return { updated: result.affected ?? 0 };
  }
  async markRead(userId: number, id: number) {
    const n = await this.repo.findOne({ where: { id, user: { id: userId } } });
    if (!n) throw new NotFoundException('Notification introuvable');
    n.readAt = new Date();
    return this.repo.save(n);
  }
}
