import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DeviceSession } from '../../auth-session/entities/device-session.entity';
import { UserAccount } from '../../auth-session/entities/user-account.entity';
import { Comment } from '../../social/entities/comment.entity';
import { Post } from '../../social/entities/post.entity';
import type {
  ContentReportReason,
  ContentReportStatus,
  ContentReportTargetType,
} from '../dto/content-report.dto';

@Entity({ name: 'content_reports' })
@Index('IDX_content_reports_status_created', ['status', 'createdAt'])
@Index('IDX_content_reports_post_id', ['postId'])
@Index('IDX_content_reports_comment_id', ['commentId'])
export class ContentReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'target_type', type: 'varchar', length: 20 })
  targetType!: ContentReportTargetType;

  @Column({ name: 'post_id', type: 'uuid', nullable: true })
  postId!: string | null;

  @ManyToOne(() => Post, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post?: Post | null;

  @Column({ name: 'comment_id', type: 'uuid', nullable: true })
  commentId!: string | null;

  @ManyToOne(() => Comment, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment?: Comment | null;

  @Column({ name: 'reporter_device_id', type: 'uuid' })
  reporterDeviceId!: string;

  @ManyToOne(() => DeviceSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_device_id' })
  reporterDevice?: DeviceSession;

  @Column({ name: 'reporter_user_account_id', type: 'uuid', nullable: true })
  reporterUserAccountId!: string | null;

  @ManyToOne(() => UserAccount, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reporter_user_account_id' })
  reporterUserAccount?: UserAccount | null;

  @Column({ type: 'varchar', length: 40 })
  reason!: ContentReportReason;

  @Column({ type: 'varchar', length: 500, nullable: true })
  details!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status!: ContentReportStatus;

  @Column({ name: 'resolved_by_user_account_id', type: 'uuid', nullable: true })
  resolvedByUserAccountId!: string | null;

  @ManyToOne(() => UserAccount, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolved_by_user_account_id' })
  resolvedByUserAccount?: UserAccount | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
