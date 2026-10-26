import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { EnvironmentVariables } from '../../config/env.validation';
import { DeviceSession } from '../../modules/auth-session/entities/device-session.entity';
import { UserAccount } from '../../modules/auth-session/entities/user-account.entity';
import {
  GLOBAL_USER_REPOSITORY,
  type IGlobalUserRepository,
} from '../../modules/auth-session/interfaces/i-global-user.repository';
import { GlobalUserMockRepository } from '../../modules/auth-session/repositories/global-user.mock-repository';
import { GlobalUserRepository } from '../../modules/auth-session/repositories/global-user.repository';
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
    {
      provide: GLOBAL_USER_REPOSITORY,
      inject: [ConfigService, { token: getDataSourceToken('global_db'), optional: true }],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
        globalDataSource?: DataSource,
      ): IGlobalUserRepository => {
        if (config.get('USE_MOCK_EXTERNAL_SERVICES', { infer: true })) {
          return new GlobalUserMockRepository();
        }
        return new GlobalUserRepository(globalDataSource);
      },
    },
    DeviceSessionGuard,
    OptionalDeviceSessionGuard,
    RolesGuard,
  ],
  exports: [
    JwtModule,
    SessionTokenService,
    DEVICE_SESSION_READER,
    GLOBAL_USER_REPOSITORY,
    DeviceSessionGuard,
    OptionalDeviceSessionGuard,
    RolesGuard,
  ],
})
export class SessionAuthModule {}
