import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Construye el documento OpenAPI 3.0 a partir de los controladores y DTOs de NestJS.
 * Centralizado aquí para mantener `main.ts` y el script de exportación limpios.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('AsisConexión Backend API')
    .setDescription(
      'API REST del Monolito Modular AsisConexión Backend v2.0.0. Opera con persistencia única PostgreSQL (ASISCONEXION_DB), integración HTTP con el servicio central de autenticación en Render/Supabase y moderación en dos capas.',
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

  return SwaggerModule.createDocument(app, config);
}

/**
 * Monta la interfaz interactiva Swagger UI en `/api/docs`.
 */
export function setupSwagger(app: INestApplication): void {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document);
}
