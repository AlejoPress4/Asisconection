import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { SessionContext } from '../../common/auth/interfaces/session-context.interface';
import { CurrentSession } from '../../common/decorators/current-session.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ProblemDetailsDto } from '../../common/filters/all-exceptions.filter';
import { DeviceSessionGuard } from '../../common/guards/device-session.guard';
import { OptionalDeviceSessionGuard } from '../../common/guards/optional-device-session.guard';
import { ActorsService } from './actors.service';
import {
  ActorConnectionResponseDto,
  ActorConnectionsPageDto,
  ActorProfileResponseDto,
  ActorsPageDto,
  CreateConnectionDto,
  DeleteConnectionResponseDto,
  ListActorsQueryDto,
  ListConnectionsQueryDto,
  UpdateActorProfileDto,
  UpdateConnectionStatusDto,
} from './dto/actor-profile.dto';

@ApiTags('AuthSession')
@Controller()
export class ActorsController {
  constructor(private readonly actorsService: ActorsService) {}

  @Get('actors')
  @ApiOperation({
    summary:
      'Busca y explora perfiles Actor registrados en la comunidad (paginado RT-01, respeta Ley 1581)',
  })
  @ApiOkResponse({ type: ActorsPageDto })
  async searchActors(@Query() query: ListActorsQueryDto): Promise<ActorsPageDto> {
    return this.actorsService.searchActors(query);
  }

  @Get('actors/me')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Consulta el perfil Actor del usuario registrado actual (prohibido para anónimos)',
  })
  @ApiOkResponse({ type: ActorProfileResponseDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  async getMyProfile(@CurrentSession() session: SessionContext): Promise<ActorProfileResponseDto> {
    return this.actorsService.getMyProfile(session);
  }

  @Patch('actors/me')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Actualiza el perfil Actor del usuario registrado actual',
  })
  @ApiOkResponse({ type: ActorProfileResponseDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  async updateMyProfile(
    @CurrentSession() session: SessionContext,
    @Body() dto: UpdateActorProfileDto,
  ): Promise<ActorProfileResponseDto> {
    return this.actorsService.updateMyProfile(session, dto);
  }

  @Get('actors/:id')
  @UseGuards(OptionalDeviceSessionGuard)
  @ApiOperation({
    summary:
      'Consulta pública de un perfil Actor por UUID (incluye viewer_connection si hay sesión registrada)',
  })
  @ApiOkResponse({ type: ActorProfileResponseDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  async getActorById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentSession() optionalSession?: SessionContext,
  ): Promise<ActorProfileResponseDto> {
    return this.actorsService.getActorById(id, optionalSession);
  }

  @Get('actors/:id/followers')
  @ApiOperation({
    summary: 'Lista paginada de seguidores (conexiones ACCEPTED entrantes) de un perfil Actor',
  })
  @ApiOkResponse({ type: ActorsPageDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  async listFollowers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<ActorsPageDto> {
    return this.actorsService.listFollowers(id, query);
  }

  @Get('actors/:id/following')
  @ApiOperation({
    summary: 'Lista paginada de perfiles seguidos (conexiones ACCEPTED salientes) por un perfil Actor',
  })
  @ApiOkResponse({ type: ActorsPageDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  async listFollowing(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<ActorsPageDto> {
    return this.actorsService.listFollowing(id, query);
  }

  @Post('connections')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Envía solicitud de conexión entre perfiles Actor (exclusivo usuarios registrados)',
  })
  @ApiCreatedResponse({ type: ActorConnectionResponseDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  async createConnection(
    @CurrentSession() session: SessionContext,
    @Body() dto: CreateConnectionDto,
  ): Promise<ActorConnectionResponseDto> {
    return this.actorsService.createConnection(session, dto);
  }

  @Patch('connections/:id')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Acepta (ACCEPTED) o bloquea (BLOCKED) una conexión entre perfiles Actor',
  })
  @ApiOkResponse({ type: ActorConnectionResponseDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  async updateConnectionStatus(
    @CurrentSession() session: SessionContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateConnectionStatusDto,
  ): Promise<ActorConnectionResponseDto> {
    return this.actorsService.updateConnectionStatus(session, id, dto);
  }

  @Delete('connections/:id')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Elimina una conexión o cancela una solicitud pendiente (dejar de seguir / unfollow)',
  })
  @ApiOkResponse({ type: DeleteConnectionResponseDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  async deleteConnection(
    @CurrentSession() session: SessionContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DeleteConnectionResponseDto> {
    return this.actorsService.deleteConnection(session, id);
  }

  @Get('connections')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  @ApiOperation({
    summary: 'Lista paginada de conexiones del perfil Actor actual con filtros status y direction',
  })
  @ApiOkResponse({ type: ActorConnectionsPageDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  async listMyConnections(
    @CurrentSession() session: SessionContext,
    @Query() query: ListConnectionsQueryDto,
  ): Promise<ActorConnectionsPageDto> {
    return this.actorsService.listMyConnections(session, query);
  }
}
