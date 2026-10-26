import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import type { CategoryProjection, ICategoryRepository } from '../interfaces/i-category.repository';

@Injectable()
export class CategoryRepository implements ICategoryRepository {
  constructor(
    @InjectRepository(Category)
    private readonly repository: Repository<Category>,
  ) {}

  async findPaginated(
    skip: number,
    take: number,
  ): Promise<{ items: CategoryProjection[]; total: number }> {
    const [entities, total] = await this.repository
      .createQueryBuilder('c')
      .select(['c.id', 'c.name', 'c.description'])
      .orderBy('c.name', 'ASC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const items: CategoryProjection[] = entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      description: entity.description,
    }));

    return { items, total };
  }

  async existsById(id: string): Promise<boolean> {
    const count = await this.repository.count({ where: { id } });
    return count > 0;
  }
}
