import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ModerationStatus } from '../../../common/enums/moderation-status.enum';
import { DeviceSession } from '../../auth-session/entities/device-session.entity';
import { UserAccount } from '../../auth-session/entities/user-account.entity';
import { Category } from './category.entity';
import { PostMedia } from './post-media.entity';

@Entity({ name: 'posts' })
@Index('IDX_posts_status', ['status'])
@Index('IDX_posts_created_at', ['createdAt'])
@Index('IDX_posts_status_category_created', ['status', 'categoryId', 'createdAt'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category?: Category;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl!: string | null;

  @OneToMany(() => PostMedia, (media) => media.post)
  media?: PostMedia[];

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

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
