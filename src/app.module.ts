import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SessionAuthModule } from './common/auth/session-auth.module';
import { validate } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { AuthSessionModule } from './modules/auth-session/auth-session.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { SocialModule } from './modules/social/social.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    DatabaseModule,
    SessionAuthModule,
    AuthSessionModule,
    SocialModule,
    ModerationModule,
    DirectoryModule,
    AssistantModule,
  ],
})
export class AppModule {}
