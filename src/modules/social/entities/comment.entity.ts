import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import { DeviceSession } from '../../auth-session/entities/device-session.entity';
import { UserAccount } from '../../auth-session/entities/user-account.entity';
import { Post } from './post.entity';

@Entity({ name: 'comments' })
@Index('IDX_comments_status', ['status'])
@Index('IDX_comments_post_status_created', ['postId', 'status', 'createdAt'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'post_id', type: 'uuid' })
  postId!: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post?: Post;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => Comment, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent?: Comment | null;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId!: string;

  @ManyToOne(() => DeviceSession, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'device_id' })
  device?: DeviceSession;

  @Column({ name: 'user_account_id', type: 'uuid', nullable: true })
  userAccountId!: string | null;

  @ManyToOne(() => UserAccount, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_account_id' })
  userAccount?: UserAccount | null;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'enum',
    enum: ModerationStatus,
    enumName: 'moderation_status_enum',
    default: ModerationStatus.PENDING,
  })
  status!: ModerationStatus;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 40, nullable: true })
  rejectionReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
