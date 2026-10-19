import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { TypeOrmModule } from '@nestjs/typeorm';

import { WatchItem } from './entities/watch-item.entity';

import { WatchVersion } from './entities/watch-version.entity';

import { DeduplicationService } from './deduplication.service';

import { WatchItemsService } from './watch-items.service';

import { WatchItemsController } from './watch-items.controller';
import { AiAnalysisModule } from '../ai/ai-analysis.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([WatchItem, WatchVersion]),
    AiAnalysisModule,
  ],

  providers: [DeduplicationService, WatchItemsService],

  controllers: [WatchItemsController],

  exports: [WatchItemsService],
})
export class WatchItemsModule {}
