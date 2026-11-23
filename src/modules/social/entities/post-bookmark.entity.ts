import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { DeviceSession } from '../../auth-session/entities/device-session.entity';
import { UserAccount } from '../../auth-session/entities/user-account.entity';
import { Post } from './post.entity';

@Entity({ name: 'post_bookmarks' })
@Unique('UQ_post_bookmarks_post_device', ['postId', 'deviceId'])
@Index('IDX_post_bookmarks_device_created', ['deviceId', 'createdAt'])
@Index('IDX_post_bookmarks_user_created', ['userAccountId', 'createdAt'])
export class PostBookmark {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'post_id', type: 'uuid' })
  postId!: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post?: Post;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId!: string;

  @ManyToOne(() => DeviceSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device?: DeviceSession;

  @Column({ name: 'user_account_id', type: 'uuid', nullable: true })
  userAccountId!: string | null;

  @ManyToOne(() => UserAccount, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_account_id' })
  userAccount?: UserAccount | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
