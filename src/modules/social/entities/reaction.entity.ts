import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ReactionType } from '../../../common/enums/reaction-type.enum';
import { DeviceSession } from '../../auth-session/entities/device-session.entity';
import { UserAccount } from '../../auth-session/entities/user-account.entity';
import { Post } from './post.entity';

@Entity({ name: 'reactions' })
@Unique('UQ_reactions_post_device_type', ['postId', 'deviceId', 'type'])
export class Reaction {
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

  @ManyToOne(() => UserAccount, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_account_id' })
  userAccount?: UserAccount | null;

  @Column({ type: 'varchar', length: 20 })
  type!: ReactionType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
