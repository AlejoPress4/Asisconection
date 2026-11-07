# AsisConexión Backend (`v2.0.0`)

Backend **Monolito Modular en NestJS + TypeScript estricto** para **AsisConexión** (clientes React Native y Web de la **Fundación Asisco**).

---

## 1. Visión General para Nuevos Desarrolladores

¿Cómo funciona el sistema en 4 puntos clave?

1. **Una sola Base de Datos Propia (`ASISCONEXION_DB` en PostgreSQL / Supabase)**:
   - Todas las tablas del foro, sesiones, perfiles `Actor`, conexiones, reacciones, enlaces y FAQs viven en una única base de datos PostgreSQL configurada en `DB_LOCAL_URL`.
2. **Autenticación Delegada por HTTP (`Render / Supabase`)**:
   - El backend **nunca guarda contraseñas (`clave`)**.
   - Cuando un usuario hace login (`POST /v1/auth/login`) o se registra (`POST /v1/auth/registro`), `ExternalAuthHttpAdapter` valida las credenciales contra el servicio central (`RENDER_API_URL`), sincroniza localmente `UserAccount` + `Actor` (1:1) y emite un JWT propio de sesión (`device_token`).
   - Los visitantes sin cuenta pueden iniciar una sesión rápida por dispositivo (`POST /v1/sessions/anonymous`) con límite diario de publicación y sin perfil `Actor`.
3. **Moderación en Dos Capas (`ContentFilterService` + `RN-02`)**:
   - **Capa 1 (Filtro Automático)**: Todo `Post` y `Comment` pasa primero por `ContentFilterService` (groserías, enlaces externos, datos de menores y spam). Si infringe alguna regla, se guarda como `REJECTED` (`rejection_reason = 'AUTO_FILTER'`).
   - **Capa 2 (Revisión Humana `RN-02`)**: Si supera el filtro automático, nace en `status = 'PENDING'`. Solo se muestra en el muro público (`GET /v1/posts`) cuando un `ADMIN` o `MODERATOR` lo aprueba (`APPROVED`).
4. **Roles Globales (`ADMIN` y `MODERATOR`)**:
   - Quienes vienen con `'ADMIN'` desde el servicio externo tienen permisos completos de administración y pueden nombrar o revocar moderadores globales (`PUT/DELETE /v1/admin/moderators/:userAccountId`).
   - Los `MODERATOR` pueden aprobar o rechazar publicaciones y comentarios pendientes, pero no gestionar otros moderadores.

---

## 2. Arquitectura y Estructura del Código (`src/`)

Cada módulo sigue separación estricta de responsabilidades (**SOLID / DIP**):
- `*.controller.ts`: Rutas HTTP, validación de entrada (`DTOs`) y documentación `@nestjs/swagger`.
- `*.service.ts`: Reglas de negocio (depende de interfaces `Symbol`, nunca de repositorios concretos).
- `*.repository.ts` / `*.adapter.ts`: Consultas TypeORM/SQL o llamadas HTTP externas (`@nestjs/axios`).

```text
src/
├── main.ts                          # Bootstrap, ValidationPipe, AllExceptionsFilter (RFC 7807) y Swagger (/api/docs)
├── app.module.ts                    # Módulo raíz que ensambla los 5 módulos de dominio
├── config/
│   └── env.validation.ts            # Validación tipada de variables de entorno (.env)
├── common/
│   ├── auth/                        # Emisión/verificación de JWT de sesión (SessionTokenService)
│   ├── decorators/                  # @CurrentSession() y @Roles('ADMIN', 'MODERATOR')
│   ├── dto/                         # Paginación estándar (PaginationQueryDto, PaginationMetaDto)
│   ├── enums/                       # ModerationStatus (PENDING/APPROVED/REJECTED), ReactionType
│   ├── filters/                     # AllExceptionsFilter (errores en formato RFC 7807 problem+json)
│   ├── guards/                      # DeviceSessionGuard, OptionalDeviceSessionGuard, RolesGuard
│   └── utils/                       # Redacción de campos sensibles en logs y validación booleana
├── database/
│   ├── database.module.ts           # Conexión TypeORM PostgreSQL (con soporte SSL automático para Supabase)
│   ├── data-source.ts               # Configuración para CLI de migraciones y seeders
│   ├── migrations/                  # 5 migraciones SQL reversibles del esquema completo
│   └── seeds/                       # Datos iniciales idempotentes (categorías, directorio, FAQs)
└── modules/
    ├── auth-session/                # Login/registro Render, sesiones anónimas, perfiles Actor y conexiones
    ├── social/                      # Categorías públicas, posts con media_urls, hilos de comentarios y reacciones
    ├── moderation/                  # ContentFilterService (4 reglas OCP), cola PENDING y gestión de MODERATOR
    ├── directory/                   # Enlaces a módulos satélites (SUMA 21, AULA UP, SAGA-UP)
    └── assistant/                   # Preguntas frecuentes (FaqRuleEngineProvider) y enlace a WhatsApp
```

Para una guía detallada de mantenimiento y extensión del código, consulta [docs/GUIA_MANTENIMIENTO.md](file:///home/molton334/Development/Poj-int/Asisconection/docs/GUIA_MANTENIMIENTO.md).

---

## 3. Mapa Completo de Endpoints (`/v1`)

| Módulo | Método y Ruta | Permisos | Descripción |
|---|---|---|---|
| **AuthSession** | `POST /v1/auth/registro` | Público / Bearer opc. | Registra en Render, crea `UserAccount` + `Actor` y devuelve `device_token` |
| **AuthSession** | `POST /v1/auth/login` | Público / Bearer opc. | Autentica en Render, sincroniza `UserAccount` + `Actor` y devuelve `device_token` |
| **AuthSession** | `POST /v1/auth/sync-session` | Público / Bearer opc. | Alias compatible de `/v1/auth/login` |
| **AuthSession** | `POST /v1/sessions/anonymous` | Público | Crea sesión rápida por dispositivo (`user_account_id = null`) |
| **Actors** | `GET /v1/actors/me` | `Bearer` (Registrado) | Obtiene el perfil `Actor` del usuario autenticado (`403` si es anónimo) |
| **Actors** | `PATCH /v1/actors/me` | `Bearer` (Registrado) | Actualiza nombres, rol principal, avatar o biografía del `Actor` |
| **Actors** | `GET /v1/actors/:id` | Público | Consulta el perfil público de un `Actor` por su UUID |
| **Connections** | `GET /v1/connections` | `Bearer` (Registrado) | Lista paginada de conexiones del `Actor` actual |
| **Connections** | `POST /v1/connections` | `Bearer` (Registrado) | Envía solicitud de conexión (`PENDING`) a otro `Actor` |
| **Connections** | `PATCH /v1/connections/:id` | `Bearer` (Registrado) | Acepta (`ACCEPTED`) o bloquea (`BLOCKED`) una solicitud de conexión |
| **Social** | `GET /v1/categories` | Público | Lista paginada de categorías temáticas públicas |
| **Social** | `GET /v1/posts` | Público | Muro público: solo publicaciones `APPROVED` con `media_urls`, reacciones y comentarios |
| **Social** | `POST /v1/posts` | `Bearer` | Crea publicación (pasa por `ContentFilterService` → `PENDING` o `REJECTED`) |
| **Social** | `POST /v1/posts/:postId/comments` | `Bearer` | Crea comentario raíz o respuesta en hilo (`parent_id`) |
| **Social** | `POST /v1/posts/:postId/reactions` | `Bearer` | Alterna (`toggle`) reacción `LIKE`, `SUPPORT` o `THANKS` en una publicación |
| **Social** | `POST /v1/comments/:id/reactions` | `Bearer` | Alterna (`toggle`) reacción `LIKE`, `SUPPORT` o `THANKS` en un comentario |
| **Moderation** | `GET /v1/admin/moderation/pending` | `ADMIN` o `MODERATOR` | Cola unificada paginada de publicaciones y comentarios `PENDING` |
| **Moderation** | `PATCH /v1/admin/moderation/posts/:id/status` | `ADMIN` o `MODERATOR` | Aprueba (`APPROVED`) o rechaza (`REJECTED`) una publicación |
| **Moderation** | `PATCH /v1/admin/moderation/comments/:id/status` | `ADMIN` o `MODERATOR` | Aprueba (`APPROVED`) o rechaza (`REJECTED`) un comentario |
| **Moderation** | `GET /v1/admin/moderators` | Solo `ADMIN` | Lista usuarios con rol global `MODERATOR` |
| **Moderation** | `PUT /v1/admin/moderators/:userAccountId` | Solo `ADMIN` | Asigna rol global `MODERATOR` a un usuario registrado |
| **Moderation** | `DELETE /v1/admin/moderators/:userAccountId` | Solo `ADMIN` | Revoca rol global `MODERATOR` |
| **Directory** | `GET /v1/directory/links` | Público | Enlaces activos hacia `SUMA 21`, `AULA UP` y `SAGA-UP` |
| **Assistant** | `GET /v1/assistant/faqs` | Público | Preguntas frecuentes filtrables por categoría con *disclaimer* obligatorio |
| **Assistant** | `POST /v1/assistant/escalate` | Público | Genera URL directa a WhatsApp oficial para atención humana |

---

## 4. Puesta en Marcha Rápida

```bash
# 1. Instalar dependencias
npm ci

# 2. Configurar variables de entorno (.env)
cp .env.example .env

# 3. Ejecutar migraciones y datos semilla en PostgreSQL / Supabase
npm run migration:run
npm run seed:dev

# 4. Iniciar servidor en modo desarrollo (http://localhost:3000/v1)
npm run start:dev
```

### Comandos de Verificación y Calidad

```bash
npm run build           # Compila TypeScript estricto a dist/
npm run lint            # Ejecuta ESLint sin permitir warnings (--max-warnings=0)
npm run test            # Pruebas unitarias (filtro automático OCP, FAQ y redacción de logs)
npm run test:e2e        # Pruebas de integración/contrato E2E de todos los módulos
npm run openapi:export  # Exporta dist/openapi.generated.json
```

- **Swagger UI interactivo**: `http://localhost:3000/api/docs`
- **Colección Postman / Insomnia**: [AsisConexion_v2.postman_collection.json](file:///home/molton334/Development/Poj-int/Asisconection/specs/001-asisconexion-mvp/contracts/AsisConexion_v2.postman_collection.json)
