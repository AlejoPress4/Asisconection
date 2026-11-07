import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CategoriesPageDto } from '../dto/categories-page.dto';
import { CategoriesService } from '../services/categories.service';

@ApiTags('Social')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /** Lista categorías temáticas de los foros (paginado ligero RT-01) */
  @Get()
  async list(@Query() query: PaginationQueryDto): Promise<CategoriesPageDto> {
    return this.categoriesService.list(query);
  }
}
