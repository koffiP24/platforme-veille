import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { RefreshSession } from './auth/entities/refresh-session.entity';
import { PasswordResetToken } from './auth/entities/password-reset-token.entity';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { DatabaseModule } from './database/database.module';
import { User } from './users/entities/user.entity';
import { Role } from './roles/entities/role.entity';
import { Permission } from './permissions/entities/permission.entity';
import { SourcesModule } from './sources/sources.module';
import { ConnectorsModule } from './connectors/connectors.module';
import { Source } from './sources/entities/source.entity';
import { Connector } from './connectors/entities/connector.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { CollectionModule } from './collection/collection.module';
import { WatchItem } from './watch-items/entities/watch-item.entity';
import { WatchVersion } from './watch-items/entities/watch-version.entity';
import { CollectionRun } from './collection/entities/collection-run.entity';
import { WatchItemsModule } from './watch-items/watch-items.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { Topic } from './taxonomy/entities/topic.entity';
import { Domain } from './taxonomy/entities/domain.entity';
import { Laboratory } from './taxonomy/entities/laboratory.entity';
import { Keyword } from './taxonomy/entities/keyword.entity';
import { KeywordSynonym } from './taxonomy/entities/keyword-synonym.entity';
import { WatchItemTopic } from './watch-items/entities/watch-item-topic.entity';
import { WatchItemKeyword } from './watch-items/entities/watch-item-keyword.entity';
import { ValidationModule } from './validation/validation.module';
import { ActionsModule } from './actions/actions.module';
import { Review } from './validation/entities/review.entity';
import { FollowUpAction } from './actions/entities/follow-up-action.entity';
import { QualificationModule } from './qualification/qualification.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SearchModule } from './search/search.module';
import { FavoritesModule } from './favorites/favorites.module';
import { SavedViewsModule } from './saved-views/saved-views.module';
import { Favorite } from './favorites/entities/favorite.entity';
import { SavedView } from './saved-views/entities/saved-view.entity';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { Subscription } from './subscriptions/entities/subscription.entity';
import { Notification } from './notifications/entities/notification.entity';
import { Report } from './reports/entities/report.entity';
import { HealthModule } from './health/health.module';
import { AuditModule } from './audit/audit.module';
import { AuditLog } from './audit/entities/audit-log.entity';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit/audit.interceptor';
import { rateLimitOptions } from './auth/rate-limit.config';
import { AiAnalysisModule } from './ai/ai-analysis.module';
import { WatchItemAiAnalysis } from './ai/entities/watch-item-ai-analysis.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ScheduleModule.forRoot(),

    EventEmitterModule.forRoot(),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: rateLimitOptions,
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',

      host: process.env.DB_HOST ?? 'localhost',

      port: Number(process.env.DB_PORT ?? 5432),

      username: process.env.DB_USERNAME ?? 'postgres',

      password: process.env.DB_PASSWORD,

      database: process.env.DB_NAME ?? 'veille',

      entities: [
        User,
        RefreshSession,
        PasswordResetToken,
        Role,
        Permission,
        Source,
        Connector,
        WatchItem,
        WatchVersion,
        CollectionRun,
        Topic,
        Domain,
        Laboratory,
        Keyword,
        KeywordSynonym,
        WatchItemTopic,
        WatchItemKeyword,
        Review,
        FollowUpAction,
        Favorite,
        SavedView,
        Subscription,
        Notification,
        Report,
        AuditLog,
        WatchItemAiAnalysis,
      ],

      synchronize: false,
    }),

    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    DatabaseModule,
    SourcesModule,
    ConnectorsModule,
    CollectionModule,
    WatchItemsModule,
    TaxonomyModule,
    QualificationModule,
    DashboardModule,
    ValidationModule,
    ActionsModule,
    SearchModule,
    FavoritesModule,
    SavedViewsModule,
    SubscriptionsModule,
    NotificationsModule,
    ReportsModule,
    HealthModule,
    AuditModule,
    AiAnalysisModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
