import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WatchItem } from '../../watch-items/entities/watch-item.entity';
import { User } from '../../users/entities/user.entity';

@Entity('watch_item_ai_analyses')
export class WatchItemAiAnalysis {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => WatchItem, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'watch_item_id' })
  watchItem: WatchItem;
  @Column({ name: 'supersedes_id', type: 'integer', nullable: true })
  supersedesId: number | null;
  @Column({ name: 'requested_by_id', type: 'integer', nullable: true })
  requestedById: number | null;
  @Column({ name: 'reviewed_by_id', type: 'integer', nullable: true })
  reviewedById: number | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_id', referencedColumnName: 'id', foreignKeyConstraintName: 'FK_watch_item_ai_analyses_reviewer' })
  reviewedBy: User | null;
  @Column({ length: 30, default: 'openai' }) provider: string;
  @Column({ length: 100 }) model: string;
  @Column({ name: 'source_fingerprint', length: 64 }) sourceFingerprint: string;
  @Column({ name: 'relevance_score', type: 'smallint' }) relevanceScore: number;
  @Column({ name: 'relevance_reason', type: 'text' }) relevanceReason: string;
  @Column({ type: 'text', nullable: true }) summary: string | null;
  @Column({
    name: 'potential_impacts',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  potentialImpacts: string[];
  @Column({
    name: 'recommended_checks',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  recommendedChecks: string[];
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  classification: {
    watchType: string | null;
    themes: string[];
    domains: string[];
    keywords: string[];
    keywordWeights: number[];
    laboratories: string[];
    rationale: string;
  };
  @Column({ length: 20, default: 'PROPOSED' }) status: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
