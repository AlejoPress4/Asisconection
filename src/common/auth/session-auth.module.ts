import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EnvironmentVariables } from '../../config/env.validation';
import { DeviceSession } from '../../modules/auth-session/entities/device-session.entity';
import { UserAccount } from '../../modules/auth-session/entities/user-account.entity';
import { DeviceSessionGuard } from '../guards/device-session.guard';
import { OptionalDeviceSessionGuard } from '../guards/optional-device-session.guard';
import { RolesGuard } from '../guards/roles.guard';
import { DeviceSessionReaderRepository } from './device-session-reader.repository';
import { DEVICE_SESSION_READER } from './interfaces/i-device-session-reader';
import { SessionTokenService } from './session-token.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }),
        },
      }),
    }),
    TypeOrmModule.forFeature([DeviceSession, UserAccount]),
  ],
  providers: [
    SessionTokenService,
    {
      provide: DEVICE_SESSION_READER,
      useClass: DeviceSessionReaderRepository,
    },
    DeviceSessionGuard,
    OptionalDeviceSessionGuard,
    RolesGuard,
  ],
  exports: [
    JwtModule,
    SessionTokenService,
    DEVICE_SESSION_READER,
    DeviceSessionGuard,
    OptionalDeviceSessionGuard,
    RolesGuard,
  ],
})
export class SessionAuthModule {}
