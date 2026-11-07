import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { DirectoryService } from './directory.service';
import { RedirectionLinksPageDto } from './dto/redirection-link-response.dto';

@ApiTags('Directory')
@Controller('directory')
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  /** Lista enlaces activos a módulos satélites para apertura externa nativa */
  @Get('links')
  async listActive(@Query() query: PaginationQueryDto): Promise<RedirectionLinksPageDto> {
    return this.directoryService.listActive(query);
  }
}
