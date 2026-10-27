import { Inject, Injectable } from '@nestjs/common';
import type { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { buildPaginationMeta } from '../../../common/dto/pagination.util';
import type { CategoriesPageDto } from '../dto/categories-page.dto';
import {
  CATEGORY_REPOSITORY,
  type ICategoryRepository,
} from '../interfaces/i-category.repository';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
  ) {}

  async list(query: PaginationQueryDto): Promise<CategoriesPageDto> {
    const { items, total } = await this.categoryRepository.findPaginated(query.skip, query.limit);

    return {
      data: items.map((item) => ({
        id: item.id,
        name: item.name,
        main_topic: item.mainTopic ?? 'General',
        description: item.description,
        cover_image_url: item.coverImageUrl ?? null,
      })),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }
}
