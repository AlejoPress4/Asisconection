import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { SessionContext } from '../../common/auth/interfaces/session-context.interface';
import { CurrentSession } from '../../common/decorators/current-session.decorator';
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

  /** Registra usuario en Render, sincroniza UserAccount + Actor local y emite DeviceSession */
  @Post('auth/registro')
  @UseGuards(OptionalDeviceSessionGuard)
  async register(
    @Body() dto: RegisterUserDto,
    @CurrentSession() optionalSession?: SessionContext,
  ): Promise<AuthSessionResponseDto> {
    return this.authSessionService.register(dto, optionalSession);
  }

  /** Autentica usuario contra Render/Supabase, sincroniza UserAccount + Actor y emite device_token */
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalDeviceSessionGuard)
  async login(
    @Body() dto: SyncSessionDto,
    @CurrentSession() optionalSession?: SessionContext,
  ): Promise<AuthSessionResponseDto> {
    return this.authSessionService.login(dto, optionalSession);
  }

  /** Alias compatible de inicio/sincronización de sesión con el servicio central */
  @Post('auth/sync-session')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalDeviceSessionGuard)
  async syncSession(
    @Body() dto: SyncSessionDto,
    @CurrentSession() optionalSession?: SessionContext,
  ): Promise<AuthSessionResponseDto> {
    return this.authSessionService.syncSession(dto, optionalSession);
  }

  /** Inicia sesión rápida por dispositivo sin registro de cuenta ni perfil Actor */
  @Post('sessions/anonymous')
  async initAnonymous(
    @Body() dto: InitAnonymousSessionDto,
  ): Promise<AnonymousSessionResponseDto> {
    return this.authSessionService.initAnonymous(dto);
  }
}
