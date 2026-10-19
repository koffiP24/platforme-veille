import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Connector } from '../connectors/entities/connector.entity';
import { WatchItem } from '../watch-items/entities/watch-item.entity';
import { User } from '../users/entities/user.entity';
import { Laboratory } from '../taxonomy/entities/laboratory.entity';
import { AiAnalysisController } from './ai-analysis.controller';
import { AiAnalysisService } from './ai-analysis.service';
import { WatchItemAiAnalysis } from './entities/watch-item-ai-analysis.entity';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([WatchItemAiAnalysis, WatchItem, Connector, User, Laboratory]),
    AuditModule,
  ],
  providers: [AiAnalysisService],
  controllers: [AiAnalysisController],
  exports: [AiAnalysisService],
})
export class AiAnalysisModule {}
