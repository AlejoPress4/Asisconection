import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ProblemDetailsDto } from '../../../common/filters/all-exceptions.filter';
import { CategoriesPageDto } from '../dto/categories-page.dto';
import { CategoriesService } from '../services/categories.service';

@ApiTags('Social')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista categorías temáticas de los foros (paginado ligero RT-01)',
  })
  @ApiOkResponse({
    description: 'Página de categorías',
    type: CategoriesPageDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de paginación inválidos',
    type: ProblemDetailsDto,
  })
  async list(@Query() query: PaginationQueryDto): Promise<CategoriesPageDto> {
    return this.categoriesService.list(query);
  }
}
