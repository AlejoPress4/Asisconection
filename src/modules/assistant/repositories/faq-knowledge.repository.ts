import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { FaqKnowledge } from '../entities/faq-knowledge.entity';
import type {
  CreateFaqKnowledgeInput,
  FaqKnowledgeProjection,
  IFaqKnowledgeRepository,
  UpdateFaqKnowledgeInput,
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

  async create(input: CreateFaqKnowledgeInput): Promise<FaqKnowledgeProjection> {
    const entity = this.repository.create({
      question: input.question.trim(),
      answer: input.answer.trim(),
      category: input.category.trim(),
    });
    const saved = await this.repository.save(entity);
    return {
      id: saved.id,
      question: saved.question,
      answer: saved.answer,
      category: saved.category,
    };
  }

  async update(
    id: string,
    input: UpdateFaqKnowledgeInput,
  ): Promise<FaqKnowledgeProjection | null> {
    const existing = await this.repository.findOne({ where: { id } });
    if (!existing) {
      return null;
    }

    if (input.question !== undefined) {
      existing.question = input.question.trim();
    }
    if (input.answer !== undefined) {
      existing.answer = input.answer.trim();
    }
    if (input.category !== undefined) {
      existing.category = input.category.trim();
    }

    const saved = await this.repository.save(existing);
    return {
      id: saved.id,
      question: saved.question,
      answer: saved.answer,
      category: saved.category,
    };
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
