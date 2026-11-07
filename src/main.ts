import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { validationExceptionFactory } from './common/filters/validation-exception.factory';
import type { EnvironmentVariables } from './config/env.validation';
import { setupSwagger } from './config/swagger.config';

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
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: corsOrigins
      ? corsOrigins
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : true,
    credentials: true,
  });

  app.enableShutdownHooks();
  setupSwagger(app);

  await app.listen(port);
  logger.log(`AsisConexión Backend escuchando en http://localhost:${port}/v1`);
  logger.log(`Swagger OpenAPI disponible en http://localhost:${port}/api/docs`);
}

if (require.main === module) {
  void bootstrap();
}
