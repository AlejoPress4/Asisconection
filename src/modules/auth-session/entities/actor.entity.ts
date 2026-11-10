import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UserAccount } from './user-account.entity';

@Entity({ name: 'actors' })
@Unique('UQ_actors_user_account_id', ['userAccountId'])
export class Actor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_account_id', type: 'uuid' })
  userAccountId!: string;

  @OneToOne(() => UserAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_account_id' })
  userAccount!: UserAccount;

  @Column({ name: 'primary_role', type: 'varchar', length: 40 })
  primaryRole!: string;

  @Column({ name: 'first_names', type: 'varchar', length: 80, nullable: true })
  firstNames!: string | null;

  @Column({ name: 'last_names', type: 'varchar', length: 80, nullable: true })
  lastNames!: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'short_bio', type: 'varchar', length: 500, nullable: true })
  shortBio!: string | null;

  @Column({ name: 'birth_date', type: 'varchar', length: 20, nullable: true })
  birthDate?: string | null;

  @Column({ name: 'city', type: 'varchar', length: 80, nullable: true })
  city?: string | null;

  @Column({ name: 'show_email', type: 'boolean', default: false })
  showEmail?: boolean;

  @Column({ name: 'show_birth_date', type: 'boolean', default: false })
  showBirthDate?: boolean;

  @Column({ name: 'show_city', type: 'boolean', default: false })
  showCity?: boolean;

  @Column({ name: 'require_follow_approval', type: 'boolean', default: false })
  requireFollowApproval?: boolean;

  @Column({ name: 'last_notifications_read_at', type: 'timestamptz', nullable: true })
  lastNotificationsReadAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
