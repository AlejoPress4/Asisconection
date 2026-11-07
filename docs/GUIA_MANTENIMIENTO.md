# Guía de Mantenimiento y Extensión — AsisConexión Backend

Esta guía está pensada para cualquier desarrollador que tome el proyecto en el futuro y necesite entender cómo está organizado, cómo depurarlo o cómo agregar nuevas funcionalidades sin romper la arquitectura.

---

## 1. Modelo de Base de Datos (`ASISCONEXION_DB`)

El proyecto utiliza **11 tablas de dominio** en PostgreSQL (local o Supabase), gestionadas mediante migraciones TypeORM en `src/database/migrations/`:

| Tabla | Entidad TypeORM | Propósito |
|---|---|---|
| `user_accounts` | `UserAccount` | Cuenta sincronizada desde el servicio externo (`external_user_id`, `username`, `email`, `rol`, `external_roles`, `local_role`). Nunca almacena `clave`. |
| `actors` | `Actor` | Perfil social extendido 1:1 exclusivo para usuarios registrados (`primary_role`, `first_names`, `last_names`, `avatar_url`, `short_bio`). |
| `actor_connections` | `ActorConnection` | Solicitudes y vínculos entre perfiles `Actor` (`PENDING`, `ACCEPTED`, `BLOCKED`). |
| `device_sessions` | `DeviceSession` | Sesión activa por dispositivo (`device_token` JWT, `consent_accepted_at` obligatorio por Ley 1581). |
| `categories` | `Category` | Categorías públicas del foro (`name`, `main_topic`, `description`, `cover_image_url`). |
| `posts` | `Post` | Publicaciones comunitarias (`status`: `PENDING`, `APPROVED`, `REJECTED`; `rejection_reason`: `AUTO_FILTER` o `HUMAN`). |
| `post_media` | `PostMedia` | Hasta 5 URLs multimedia por publicación (`media_url`, `display_order`). |
| `comments` | `Comment` | Comentarios sobre publicaciones aprobadas, con soporte de hilos (`parent_id`) y moderación. |
| `reactions` | `Reaction` | Reacciones (`LIKE`, `SUPPORT`, `THANKS`) sobre publicaciones (1 por dispositivo y tipo). |
| `comment_reactions` | `CommentReaction` | Reacciones (`LIKE`, `SUPPORT`, `THANKS`) sobre comentarios aprobados. |
| `redirection_links` | `RedirectionLink` | Enlaces a plataformas externas de la fundación (`SUMA 21`, `AULA UP`, `SAGA-UP`). |
| `faq_knowledge` | `FaqKnowledge` | Base de preguntas frecuentes categorizadas para el asistente orientativo. |

---

## 2. Flujo de Autenticación y Sesiones

1. **Modo Real (`USE_MOCK_EXTERNAL_SERVICES=false`)**:
   - `AuthSessionModule` inyecta `ExternalAuthHttpAdapter` bajo el token `EXTERNAL_AUTH_ADAPTER`.
   - Consume `RENDER_API_URL` (`https://proyecto-integrador-backend-g2.onrender.com`).
2. **Modo Desarrollo Local / Pruebas (`USE_MOCK_EXTERNAL_SERVICES=true`)**:
   - `AuthSessionModule` inyecta `ExternalAuthMockAdapter` con 3 usuarios precargados (contraseña `ClaveAsisco2026`):
     - `admin@asisco.org` (`ADMIN`)
     - `maria@prueba.com` (`ACUDIENTE`)
     - `carlos@asisco.org` (`VOLUNTARIO`)
3. **Validación en cada petición protegida (`DeviceSessionGuard`)**:
   - Extrae `Authorization: Bearer <device_token>`.
   - Verifica la firma JWT (`SessionTokenService`) y comprueba en `device_sessions` que la sesión exista, tenga `consent_accepted_at` no nulo y que la cuenta no esté inactiva.

---

## 3. Cómo Extender Funcionalidades Comunes

### 3.1 Agregar una nueva regla al Filtro Automático de Contenido (OCP)
El filtro automático (`ContentFilterService`) evalúa un arreglo de reglas que implementan la interfaz `IContentRule` (`src/modules/moderation/interfaces/i-content-rule.interface.ts`):
1. Crea una clase en `src/modules/moderation/rules/mi-nueva.rule.ts` que implemente `IContentRule` (`readonly ruleName: string` y `isViolated(content: string): boolean`).
2. Regístrala en el arreglo del proveedor `CONTENT_FILTER_RULES` dentro de `src/modules/moderation/moderation.module.ts`.
3. No necesitas tocar `PostsService` ni `ContentFilterService`.

### 3.2 Agregar un nuevo Endpoint
1. **DTO**: Crea o actualiza el DTO en `src/modules/<modulo>/dto/` usando decoradores de `class-validator` y `@nestjs/swagger` (`@ApiProperty`).
2. **Interfaz y Repositorio**: Si requiere una consulta nueva, agrégala a la interfaz `i-*.repository.ts` y a la clase `*.repository.ts`.
3. **Servicio y Controlador**: Implementa la lógica en `*.service.ts` y expón la ruta en `*.controller.ts`.
4. **Exportar OpenAPI**: Ejecuta `npm run openapi:export` para actualizar `dist/openapi.generated.json`.

### 3.3 Conexión a Supabase vs PostgreSQL Local
- `DatabaseModule` y `src/database/data-source.ts` detectan automáticamente si `DB_LOCAL_URL` contiene `.supabase.co`, `.supabase.com` o `sslmode=require` y activan `ssl: { rejectUnauthorized: false }`.
- Si tu red local solo tiene conectividad IPv4 y te conectas a Supabase, usa la URI del **Session Pooler** de Supabase (`postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres`).
