import '../common/types/express';
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
import { AuthSessionController } from '../modules/auth-session/auth-session.controller';
import { AuthSessionService } from '../modules/auth-session/auth-session.service';
import { RenderAuthMockAdapter } from '../modules/auth-session/adapters/render-auth.mock-adapter';
import { GLOBAL_USER_REPOSITORY } from '../modules/auth-session/interfaces/i-global-user.repository';
import { USER_SYNC_REPOSITORY } from '../modules/auth-session/interfaces/i-local-user.repository';
import { RENDER_AUTH_ADAPTER } from '../modules/auth-session/interfaces/i-render-auth.adapter';
import { GlobalUserMockRepository } from '../modules/auth-session/repositories/global-user.mock-repository';
import { DirectoryController } from '../modules/directory/directory.controller';
import { DirectoryService } from '../modules/directory/directory.service';
import { REDIRECTION_LINK_REPOSITORY } from '../modules/directory/interfaces/i-redirection-link.repository';
import { ModerationController } from '../modules/moderation/moderation.controller';
import { ModerationService } from '../modules/moderation/moderation.service';
import { MODERATION_REPOSITORY } from '../modules/moderation/interfaces/i-moderation.repository';
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
    { provide: GLOBAL_USER_REPOSITORY, useClass: GlobalUserMockRepository },
    { provide: RENDER_AUTH_ADAPTER, useClass: RenderAuthMockAdapter },
    { provide: USER_SYNC_REPOSITORY, useValue: {} },
    { provide: CATEGORY_REPOSITORY, useValue: {} },
    { provide: POST_REPOSITORY, useValue: {} },
    { provide: COMMENT_REPOSITORY, useValue: {} },
    { provide: REACTION_REPOSITORY, useValue: {} },
    { provide: MODERATION_REPOSITORY, useValue: {} },
    { provide: REDIRECTION_LINK_REPOSITORY, useValue: {} },
    { provide: FAQ_KNOWLEDGE_REPOSITORY, useValue: {} },
    { provide: ASSISTANT_ENGINE_PROVIDER, useClass: FaqRuleEngineProvider },
    AuthSessionService,
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
      'Contrato OpenAPI-First (SDD) del Monolito Modular AsisConexión Backend. Opera con persistencia dual PostgreSQL (ASISCONEXION_DB + FOUNDATION_GLOBAL_DB) e integración HTTP activa con el servicio central de autenticación en Render.',
    )
    .setVersion('1.0.0')
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
