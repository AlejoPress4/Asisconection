import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'user_accounts' })
@Unique('UQ_user_accounts_external_user_id', ['externalUserId'])
@Unique('UQ_user_accounts_username', ['username'])
@Unique('UQ_user_accounts_email', ['email'])
@Index('IDX_user_accounts_is_active', ['isActive'])
export class UserAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'external_user_id', type: 'varchar', length: 120, nullable: true })
  externalUserId!: string | null;

  @Column({ type: 'varchar', length: 80 })
  username!: string;

  @Column({ type: 'varchar', length: 120 })
  email!: string;

  @Column({ type: 'varchar', length: 40 })
  rol!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_synced_at', type: 'timestamptz' })
  lastSyncedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
