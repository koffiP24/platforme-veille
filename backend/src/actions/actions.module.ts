import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FollowUpAction } from './entities/follow-up-action.entity';
import { WatchItem } from '../watch-items/entities/watch-item.entity';
import { User } from '../users/entities/user.entity';
import { ActionsService } from './actions.service';
import { ActionsController } from './actions.controller';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([FollowUpAction, WatchItem, User]),
    AuditModule,
    NotificationsModule,
  ],
  providers: [ActionsService],
  controllers: [ActionsController],
  exports: [ActionsService],
})
export class ActionsModule {}
