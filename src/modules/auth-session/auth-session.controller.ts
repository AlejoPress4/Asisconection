import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { SessionContext } from '../../common/auth/interfaces/session-context.interface';
import { CurrentSession } from '../../common/decorators/current-session.decorator';
import { ProblemDetailsDto } from '../../common/filters/all-exceptions.filter';
import { OptionalDeviceSessionGuard } from '../../common/guards/optional-device-session.guard';
import { AuthSessionService } from './auth-session.service';
import {
  AnonymousSessionResponseDto,
  AuthSessionResponseDto,
} from './dto/auth-session-response.dto';
import { InitAnonymousSessionDto } from './dto/init-anonymous.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { SyncSessionDto } from './dto/sync-session.dto';

@ApiTags('AuthSession')
@Controller()
export class AuthSessionController {
  constructor(private readonly authSessionService: AuthSessionService) {}

  @Post('auth/registro')
  @UseGuards(OptionalDeviceSessionGuard)
  @ApiOperation({ summary: 'Registra usuario en Render, sincroniza UserAccount + Actor local y emite DeviceSession' })
  @ApiCreatedResponse({ type: AuthSessionResponseDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiBadGatewayResponse({ type: ProblemDetailsDto })
  async register(
    @Body() dto: RegisterUserDto,
    @CurrentSession() optionalSession?: SessionContext,
  ): Promise<AuthSessionResponseDto> {
    return this.authSessionService.register(dto, optionalSession);
  }

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalDeviceSessionGuard)
  @ApiOperation({ summary: 'Autentica usuario contra Render/Supabase, sincroniza UserAccount + Actor y emite device_token' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiBadGatewayResponse({ type: ProblemDetailsDto })
  async login(
    @Body() dto: SyncSessionDto,
    @CurrentSession() optionalSession?: SessionContext,
  ): Promise<AuthSessionResponseDto> {
    return this.authSessionService.login(dto, optionalSession);
  }

  @Post('auth/sync-session')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalDeviceSessionGuard)
  @ApiOperation({ summary: 'Alias compatible de inicio/sincronización de sesión con el servicio central' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiBadGatewayResponse({ type: ProblemDetailsDto })
  async syncSession(
    @Body() dto: SyncSessionDto,
    @CurrentSession() optionalSession?: SessionContext,
  ): Promise<AuthSessionResponseDto> {
    return this.authSessionService.syncSession(dto, optionalSession);
  }

  @Post('sessions/anonymous')
  @ApiOperation({ summary: 'Inicia sesión rápida por dispositivo sin registro de cuenta ni perfil Actor' })
  @ApiCreatedResponse({ type: AnonymousSessionResponseDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  async initAnonymous(
    @Body() dto: InitAnonymousSessionDto,
  ): Promise<AnonymousSessionResponseDto> {
    return this.authSessionService.initAnonymous(dto);
  }
}
