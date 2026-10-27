import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DEVICE_SESSION_READER } from '../common/auth/interfaces/i-device-session-reader';
import { SessionTokenService } from '../common/auth/session-token.service';
import { DeviceSessionGuard } from '../common/guards/device-session.guard';
import { OptionalDeviceSessionGuard } from '../common/guards/optional-device-session.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AssistantController } from '../modules/assistant/assistant.controller';
import { AssistantService } from '../modules/assistant/assistant.service';
import { ASSISTANT_ENGINE_PROVIDER } from '../modules/assistant/interfaces/i-assistant-engine.provider';
import { FAQ_KNOWLEDGE_REPOSITORY } from '../modules/assistant/interfaces/i-faq-knowledge.repository';
import { FaqRuleEngineProvider } from '../modules/assistant/providers/faq-rule-engine.provider';
import { ActorsController } from '../modules/auth-session/actors.controller';
import { ActorsService } from '../modules/auth-session/actors.service';
import { RenderAuthMockAdapter } from '../modules/auth-session/adapters/render-auth.mock-adapter';
import { AuthSessionController } from '../modules/auth-session/auth-session.controller';
import { AuthSessionService } from '../modules/auth-session/auth-session.service';
import { ACTOR_REPOSITORY } from '../modules/auth-session/interfaces/i-actor.repository';
import { USER_SYNC_REPOSITORY } from '../modules/auth-session/interfaces/i-local-user.repository';
import { RENDER_AUTH_ADAPTER } from '../modules/auth-session/interfaces/i-render-auth.adapter';
import { DirectoryController } from '../modules/directory/directory.controller';
import { DirectoryService } from '../modules/directory/directory.service';
import { REDIRECTION_LINK_REPOSITORY } from '../modules/directory/interfaces/i-redirection-link.repository';
import { ContentFilterService } from '../modules/moderation/content-filter.service';
import { CONTENT_FILTER_RULES } from '../modules/moderation/interfaces/i-content-rule.interface';
import { MODERATION_REPOSITORY } from '../modules/moderation/interfaces/i-moderation.repository';
import { ModerationController } from '../modules/moderation/moderation.controller';
import { ModerationService } from '../modules/moderation/moderation.service';
import { CategoriesController } from '../modules/social/controllers/categories.controller';
import { PostsController } from '../modules/social/controllers/posts.controller';
import { CATEGORY_REPOSITORY } from '../modules/social/interfaces/i-category.repository';
import { COMMENT_REPOSITORY } from '../modules/social/interfaces/i-comment.repository';
import { POST_REPOSITORY } from '../modules/social/interfaces/i-post.repository';
import { REACTION_REPOSITORY } from '../modules/social/interfaces/i-reaction.repository';
import { CategoriesService } from '../modules/social/services/categories.service';
import { PostsService } from '../modules/social/services/posts.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [
        () => ({
          PORT: 3000,
          NODE_ENV: 'test',
          USE_MOCK_EXTERNAL_SERVICES: true,
          DB_LOCAL_URL: 'postgresql://localhost:5432/asisconexion_db',
          JWT_SECRET: 'openapi_export_placeholder_secret_min_32_chars',
          JWT_EXPIRES_IN: '30d',
          WHATSAPP_SUPPORT_PHONE: '573001234567',
          WHATSAPP_DEFAULT_MESSAGE:
            'Hola Fundación Asisco, requiero acompañamiento humano desde AsisConexión.',
          ASSISTANT_ENGINE: 'faq',
        }),
      ],
    }),
    JwtModule.register({
      secret: 'openapi_export_placeholder_secret_min_32_chars',
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [
    AuthSessionController,
    ActorsController,
    CategoriesController,
    PostsController,
    ModerationController,
    DirectoryController,
    AssistantController,
  ],
  providers: [
    SessionTokenService,
    DeviceSessionGuard,
    OptionalDeviceSessionGuard,
    RolesGuard,
    { provide: DEVICE_SESSION_READER, useValue: { findSessionContext: () => Promise.resolve(null) } },
    { provide: RENDER_AUTH_ADAPTER, useClass: RenderAuthMockAdapter },
    { provide: USER_SYNC_REPOSITORY, useValue: {} },
    { provide: ACTOR_REPOSITORY, useValue: {} },
    { provide: CATEGORY_REPOSITORY, useValue: {} },
    { provide: POST_REPOSITORY, useValue: {} },
    { provide: COMMENT_REPOSITORY, useValue: {} },
    { provide: REACTION_REPOSITORY, useValue: {} },
    { provide: MODERATION_REPOSITORY, useValue: {} },
    { provide: CONTENT_FILTER_RULES, useValue: [] },
    ContentFilterService,
    { provide: REDIRECTION_LINK_REPOSITORY, useValue: {} },
    { provide: FAQ_KNOWLEDGE_REPOSITORY, useValue: {} },
    { provide: ASSISTANT_ENGINE_PROVIDER, useClass: FaqRuleEngineProvider },
    AuthSessionService,
    ActorsService,
    CategoriesService,
    PostsService,
    ModerationService,
    DirectoryService,
    AssistantService,
  ],
})
class OpenApiExportModule {}

async function exportOpenApiDocument(): Promise<void> {
  const app = await NestFactory.create(OpenApiExportModule, { logger: false });
  app.setGlobalPrefix('v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AsisConexión Backend API')
    .setDescription(
      'Contrato OpenAPI-First (SDD v2) del Monolito Modular AsisConexión Backend. Opera con persistencia única PostgreSQL (ASISCONEXION_DB) e integración HTTP con el servicio central de identidad en Render/Supabase.',
    )
    .setVersion('2.0.0')
    .addServer('http://localhost:3000', 'Servidor de desarrollo local')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Token JWT local emitido por AsisConexión (`device_token`) validado por `DeviceSessionGuard`.',
      },
      'DeviceSessionBearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const outputPath = resolve(process.cwd(), 'dist', 'openapi.generated.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  await app.close();
  console.log(`Documento OpenAPI exportado exitosamente en ${outputPath}`);
}

void exportOpenApiDocument();
