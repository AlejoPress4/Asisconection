import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ProblemDetailsDto } from '../../common/filters/all-exceptions.filter';
import { DeviceSessionGuard } from '../../common/guards/device-session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DirectoryService } from './directory.service';
import {
  CreateRedirectionLinkDto,
  DeletedRedirectionLinkResponseDto,
  RedirectionLinkItemDto,
  RedirectionLinksPageDto,
  UpdateRedirectionLinkDto,
} from './dto/redirection-link-response.dto';

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

@ApiTags('Admin - Ecosystem Directory')
@ApiBearerAuth('DeviceTokenAuth')
@Controller('admin/directory/links')
@UseGuards(DeviceSessionGuard, RolesGuard)
@Roles('ADMIN')
export class AdminDirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crea un nuevo enlace en el directorio del ecosistema (Solo ADMIN)',
  })
  @ApiCreatedResponse({
    description: 'Enlace del ecosistema creado',
    type: RedirectionLinkItemDto,
  })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  async createLink(@Body() dto: CreateRedirectionLinkDto): Promise<RedirectionLinkItemDto> {
    return this.directoryService.createLink(dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualiza un enlace existente del directorio del ecosistema (Solo ADMIN)',
  })
  @ApiOkResponse({
    description: 'Enlace del ecosistema actualizado',
    type: RedirectionLinkItemDto,
  })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  async updateLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRedirectionLinkDto,
  ): Promise<RedirectionLinkItemDto> {
    return this.directoryService.updateLink(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Elimina un enlace del directorio del ecosistema (Solo ADMIN)',
  })
  @ApiOkResponse({
    description: 'Enlace del ecosistema eliminado',
    type: DeletedRedirectionLinkResponseDto,
  })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  async deleteLink(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeletedRedirectionLinkResponseDto> {
    return this.directoryService.deleteLink(id);
  }
}
