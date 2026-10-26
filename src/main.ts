import './common/types/express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { validationExceptionFactory } from './common/filters/validation-exception.factory';
import type { EnvironmentVariables } from './config/env.validation';

export async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const port = configService.get('PORT', { infer: true });
  const corsOrigins = configService.get('CORS_ORIGINS', { infer: true });

  app.setGlobalPrefix('v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: corsOrigins
      ? corsOrigins
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0)
      : true,
    credentials: true,
  });

  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AsisConexión Backend API')
    .setDescription(
      'Contrato OpenAPI-First (SDD) del Monolito Modular AsisConexión Backend. Opera con persistencia dual PostgreSQL (ASISCONEXION_DB + FOUNDATION_GLOBAL_DB) e integración HTTP activa con el servicio central de autenticación en Render.',
    )
    .setVersion('1.0.0')
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

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(port);
  logger.log(`AsisConexión Backend escuchando en http://localhost:${port}/v1`);
  logger.log(`Swagger OpenAPI disponible en http://localhost:${port}/api/docs`);
}

if (require.main === module) {
  void bootstrap();
}
