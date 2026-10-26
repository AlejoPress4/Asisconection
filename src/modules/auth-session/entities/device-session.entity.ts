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
import { UserAccount } from './user-account.entity';

@Entity({ name: 'device_sessions' })
@Unique('UQ_device_sessions_device_token', ['deviceToken'])
@Index('IDX_device_sessions_user_account_id', ['userAccountId'])
export class DeviceSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_account_id', type: 'uuid', nullable: true })
  userAccountId!: string | null;

  @ManyToOne(() => UserAccount, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_account_id' })
  userAccount?: UserAccount | null;

  @Column({ name: 'device_token', type: 'varchar', length: 512 })
  deviceToken!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  nickname!: string | null;

  @Column({ name: 'role_tag', type: 'varchar', length: 40, nullable: true })
  roleTag!: string | null;

  @Column({ name: 'consent_accepted_at', type: 'timestamptz', nullable: true })
  consentAcceptedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
