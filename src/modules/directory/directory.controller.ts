import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ProblemDetailsDto } from '../../common/filters/all-exceptions.filter';
import { DirectoryService } from './directory.service';
import { RedirectionLinksPageDto } from './dto/redirection-link-response.dto';

@ApiTags('Directory')
@Controller('directory')
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get('links')
  @ApiOperation({
    summary: 'Lista enlaces activos a módulos satélites para apertura externa nativa',
  })
  @ApiOkResponse({
    description: 'Enlaces activos del directorio',
    type: RedirectionLinksPageDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de paginación inválidos',
    type: ProblemDetailsDto,
  })
  async listActive(@Query() query: PaginationQueryDto): Promise<RedirectionLinksPageDto> {
    return this.directoryService.listActive(query);
  }
}
