import { HttpModule, HttpService } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EnvironmentVariables } from '../../config/env.validation';
import { ActorsController } from './actors.controller';
import { ActorsService } from './actors.service';
import { ExternalAuthHttpAdapter } from './adapters/render-auth.http-adapter';
import { ExternalAuthMockAdapter } from './adapters/render-auth.mock-adapter';
import { AuthSessionController } from './auth-session.controller';
import { AuthSessionService } from './auth-session.service';
import { Actor } from './entities/actor.entity';
import { ActorConnection } from './entities/actor-connection.entity';
import { DeviceSession } from './entities/device-session.entity';
import { UserAccount } from './entities/user-account.entity';
import { ACTOR_REPOSITORY } from './interfaces/i-actor.repository';
import { USER_SYNC_REPOSITORY } from './interfaces/i-local-user.repository';
import {
  EXTERNAL_AUTH_ADAPTER,
  type IExternalAuthAdapter,
} from './interfaces/i-render-auth.adapter';
import { ActorRepository } from './repositories/actor.repository';
import { LocalUserRepository } from './repositories/local-user.repository';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        baseURL: config.get('RENDER_API_URL', { infer: true }) ?? 'http://localhost',
        timeout: config.get('RENDER_HTTP_TIMEOUT_MS', { infer: true }),
      }),
    }),
    TypeOrmModule.forFeature([UserAccount, Actor, ActorConnection, DeviceSession]),
  ],
  controllers: [AuthSessionController, ActorsController],
  providers: [
    {
      provide: EXTERNAL_AUTH_ADAPTER,
      inject: [ConfigService, HttpService],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
        httpService: HttpService,
      ): IExternalAuthAdapter => {
        if (config.get('USE_MOCK_EXTERNAL_SERVICES', { infer: true })) {
          return new ExternalAuthMockAdapter();
        }
        return new ExternalAuthHttpAdapter(httpService, config);
      },
    },
    {
      provide: USER_SYNC_REPOSITORY,
      useClass: LocalUserRepository,
    },
    {
      provide: ACTOR_REPOSITORY,
      useClass: ActorRepository,
    },
    AuthSessionService,
    ActorsService,
  ],
  exports: [
    AuthSessionService,
    ActorsService,
    EXTERNAL_AUTH_ADAPTER,
    USER_SYNC_REPOSITORY,
    ACTOR_REPOSITORY,
  ],
})
export class AuthSessionModule {}
