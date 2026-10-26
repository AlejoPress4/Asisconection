import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { FaqKnowledge } from '../entities/faq-knowledge.entity';
import type {
  FaqKnowledgeProjection,
  IFaqKnowledgeRepository,
} from '../interfaces/i-faq-knowledge.repository';

@Injectable()
export class FaqKnowledgeRepository implements IFaqKnowledgeRepository {
  constructor(
    @InjectRepository(FaqKnowledge)
    private readonly repository: Repository<FaqKnowledge>,
  ) {}

  async findPaginated(
    category: string | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: FaqKnowledgeProjection[]; total: number }> {
    const qb = this.repository
      .createQueryBuilder('faq')
      .select(['faq.id', 'faq.question', 'faq.answer', 'faq.category']);

    const trimmedCategory = category?.trim();
    if (trimmedCategory) {
      qb.where('LOWER(faq.category) = LOWER(:category)', { category: trimmedCategory });
    }

    const [entities, total] = await qb
      .orderBy('faq.category', 'ASC')
      .addOrderBy('faq.question', 'ASC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const items: FaqKnowledgeProjection[] = entities.map((entity) => ({
      id: entity.id,
      question: entity.question,
      answer: entity.answer,
      category: entity.category,
    }));

    return { items, total };
  }
}
