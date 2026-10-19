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

@Entity('actions')
export class FollowUpAction {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 200 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ name: 'action_type', length: 50 }) actionType: string;
  @Column({ type: 'text', nullable: true }) impact: string | null;
  @Column({ type: 'text', nullable: true }) decision: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate:
    string | null;
  @Column({ length: 30, default: 'OPEN' }) status: string;
  @Column({ name: 'progress_comment', type: 'text', nullable: true }) progressComment: string | null;
  @Column({ name: 'result', type: 'text', nullable: true }) result: string | null;
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt: Date | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt: Date | null;

  @ManyToOne(() => WatchItem, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'watch_item_id' })
  watchItem: WatchItem;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'owner_id' })
  owner: User;
}
