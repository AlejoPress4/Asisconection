import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'faq_knowledge' })
@Index('IDX_faq_knowledge_category', ['category'])
export class FaqKnowledge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 300 })
  question!: string;

  @Column({ type: 'text' })
  answer!: string;

  @Column({ type: 'varchar', length: 60 })
  category!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
