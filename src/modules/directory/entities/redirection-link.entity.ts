import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'redirection_links' })
@Index('IDX_redirection_links_is_active', ['isActive'])
export class RedirectionLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_name', type: 'varchar', length: 100 })
  projectName!: string;

  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
