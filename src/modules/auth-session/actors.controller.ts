import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { SessionContext } from '../../common/auth/interfaces/session-context.interface';
import { CurrentSession } from '../../common/decorators/current-session.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { DeviceSessionGuard } from '../../common/guards/device-session.guard';
import { ActorsService } from './actors.service';
import {
  ActorConnectionResponseDto,
  ActorConnectionsPageDto,
  ActorProfileResponseDto,
  CreateConnectionDto,
  UpdateActorProfileDto,
  UpdateConnectionStatusDto,
} from './dto/actor-profile.dto';

@ApiTags('AuthSession')
@Controller()
export class ActorsController {
  constructor(private readonly actorsService: ActorsService) {}

  /** Consulta el perfil Actor del usuario registrado actual (prohibido para anónimos) */
  @Get('actors/me')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  async getMyProfile(@CurrentSession() session: SessionContext): Promise<ActorProfileResponseDto> {
    return this.actorsService.getMyProfile(session);
  }

  /** Actualiza el perfil Actor del usuario registrado actual */
  @Patch('actors/me')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  async updateMyProfile(
    @CurrentSession() session: SessionContext,
    @Body() dto: UpdateActorProfileDto,
  ): Promise<ActorProfileResponseDto> {
    return this.actorsService.updateMyProfile(session, dto);
  }

  /** Consulta pública de un perfil Actor por UUID */
  @Get('actors/:id')
  async getActorById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ActorProfileResponseDto> {
    return this.actorsService.getActorById(id);
  }

  /** Envía solicitud de conexión entre perfiles Actor (exclusivo usuarios registrados) */
  @Post('connections')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  async createConnection(
    @CurrentSession() session: SessionContext,
    @Body() dto: CreateConnectionDto,
  ): Promise<ActorConnectionResponseDto> {
    return this.actorsService.createConnection(session, dto);
  }

  /** Acepta (ACCEPTED) o bloquea (BLOCKED) una conexión entre perfiles Actor */
  @Patch('connections/:id')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  async updateConnectionStatus(
    @CurrentSession() session: SessionContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateConnectionStatusDto,
  ): Promise<ActorConnectionResponseDto> {
    return this.actorsService.updateConnectionStatus(session, id, dto);
  }

  /** Lista paginada de conexiones del perfil Actor actual */
  @Get('connections')
  @UseGuards(DeviceSessionGuard)
  @ApiBearerAuth('DeviceSessionBearer')
  async listMyConnections(
    @CurrentSession() session: SessionContext,
    @Query() query: PaginationQueryDto,
  ): Promise<ActorConnectionsPageDto> {
    return this.actorsService.listMyConnections(session, query);
  }
}
