# Implementation Plan: AsisConexión MVP (v2) — Backend Monolito Modular con Persistencia Única e Identidad HTTP

**Branch**: `001-asisconexion-mvp` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification v2 from `specs/001-asisconexion-mvp/spec.md`

## Summary

Implementación y evolución v2 del backend de **AsisConexión** bajo una arquitectura de **Monolito Modular estricto en NestJS + TypeScript** guiada por contratos OpenAPI (`@nestjs/swagger` en `/api/docs`) y alineada con la **Constitución v2.0.0**. El sistema elimina la conexión directa a `FOUNDATION_GLOBAL_DB` y opera con una **única base de datos PostgreSQL (`ASISCONEXION_DB`)** con identificadores UUID, integrándose vía HTTP (`@nestjs/axios` a través de `IExternalAuthAdapter`) con el servicio central de autenticación desplegado en Render/Supabase (`https://proyecto-integrador-backend-g2.onrender.com`). Incluye perfiles `Actor` y red `ActorConnection` exclusivos para usuarios registrados, categorías con tema principal e imagen de portada, publicaciones con múltiples URLs multimedia (`PostMedia`), comentarios anidados en hilos (`parent_id`), reacciones en publicaciones y comentarios, moderación en dos capas (`ContentFilterService` con reglas `IContentRule` + revisión humana `RN-02` por `ADMIN` o `MODERATOR` global), directorio satélite (`RedirectionLink`) y asistente FAQ (`FaqRuleEngineProvider` detrás de `IAssistantEngineProvider`, descartando RAG en Fase 2).

## Technical Context

**Language/Version**: TypeScript `5.x` (`strict: true`, `noImplicitAny: true`, prohibición absoluta de `any`) sobre Node.js `20 LTS`

**Primary Dependencies**: NestJS (`@nestjs/common`, `@nestjs/core`, `@nestjs/config`, `@nestjs/jwt`), `@nestjs/typeorm` + `typeorm` + `pg`, `@nestjs/swagger`, `@nestjs/axios` + `axios`, `class-validator`, `class-transformer`

**Storage**: Persistencia Única PostgreSQL (`>= 15`) en `ASISCONEXION_DB` (`DB_LOCAL_URL`) con UUIDs + integración HTTP con el servicio central de identidad en Render/Supabase (`RENDER_API_URL`, `POST /auth/login`, `POST /auth/registro`, `GET /auth/perfil`)

**Testing**: Jest (pruebas unitarias y de integración por módulo) + Supertest (pruebas E2E/contrato OpenAPI y RFC 7807) con `Mocks` intercambiables por configuración (`USE_MOCK_EXTERNAL_SERVICES`) cumpliendo LSP/DIP

**Target Platform**: Servidor Linux / contenedor Node.js sirviendo clientes móviles React Native (gama de entrada) y aplicación Web

**Project Type**: Monolito Modular Backend HTTP REST (`web-service`, prefijo `/v1`, Swagger en `/api/docs`)

**Performance Goals**: Cumplimiento `RT-01` y `SC-003`: paginación obligatoria en todos los listados (`page = 1`, `limit = 20`, máx. `50`), almacenamiento multimedia exclusivamente mediante URLs y validación de sesión local mediante `device_token` para no agotar el rate-limit de Render (20 peticiones / 15 min)

**Constraints**: Errores homologados RFC 7807 (`application/problem+json`) vía `AllExceptionsFilter` (`401 UnauthorizedException`, `409 ConflictException` y `502 BadGatewayException` ante rechazos/fallos/rate-limit de Render), persistencia local confirmada en `ASISCONEXION_DB` (`UserAccount` + `Actor` + `DeviceSession`) antes de emitir `device_token`, moderación en dos capas (`ContentFilterService` -> `REJECTED` con `AUTO_FILTER` o `PENDING` -> aprobación humana `RN-02` por `ADMIN` o `MODERATOR`), cuota diaria para sesiones anónimas, trazabilidad legal `consent_accepted_at` (Ley 1581 de 2012 y Ley 1098 de 2006) y cero exposición de `clave` o tokens internos

**Scale/Scope**: 5 módulos de dominio enriquecidos (`AuthSessionModule` con subdominio `Actors` y `Connections`, `SocialModule`, `ModerationModule` con `ContentFilterService` y gestión de moderadores, `DirectoryModule`, `AssistantModule`), `DatabaseModule` con conexión única `ASISCONEXION_DB`, 11 entidades TypeORM y 22 operaciones HTTP documentadas en OpenAPI 3.1

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Evaluación Constitucional (v2.0.0)

- [x] **I. Monolito Modular & SDD OpenAPI-First**: Todos los contratos HTTP, DTOs y códigos de error están formalizados en `specs/001-asisconexion-mvp/contracts/openapi.yaml` y decorados con `@nestjs/swagger`.
- [x] **II. Persistencia Única (`ASISCONEXION_DB`) & Servicio Central de Identidad (HTTP)**: Se elimina `FOUNDATION_GLOBAL_DB`. `DatabaseModule` gestiona exclusivamente `ASISCONEXION_DB`, y `AuthSessionService` consume Render/Supabase vía `IExternalAuthAdapter` (`EXTERNAL_AUTH_ADAPTER`), persistiendo transaccionalmente `UserAccount`, `Actor` y `DeviceSession` antes de emitir el `device_token`.
- [x] **III–V. Principios SOLID (`SRP`, `OCP`, `LSP`, `ISP`, `DIP`)**: Separación estricta entre `*.controller.ts`, `*.service.ts`, `*.adapter.ts` y `*.repository.ts`; tokens de inyección (`EXTERNAL_AUTH_ADAPTER`, `USER_SYNC_REPOSITORY`, `ASSISTANT_ENGINE_PROVIDER`, `CONTENT_FILTER_RULES`) con `Mocks` LSP; `AssistantModule` conserva `IAssistantEngineProvider` con `FaqRuleEngineProvider` (sin el stub de RAG descartado); `ContentFilterService` aplica reglas abiertas `IContentRule`; DTOs segregados sin `clave` ni token opaco externo.
- [x] **Clean Code, RFC 7807 & Rendimiento (RT-01)**: Cero `any`, validación global con `ValidationPipe`, `AllExceptionsFilter` RFC 7807, paginación obligatoria y multimedia solo por URLs.
- [x] **Seguridad, Moderación en Dos Capas (RN-02), Roles (`ADMIN`/`MODERATOR`) & Cumplimiento Legal (Colombia)**: `ContentFilterService` rechaza automáticamente (`AUTO_FILTER`) groserías, enlaces externos, datos de menores y spam; el resto nace en `PENDING` y solo `APPROVED` es público; soporte de `ADMIN` (desde `external_roles`) y `MODERATOR` (en `local_role`, asignado por `ADMIN`); `consent_accepted_at` obligatorio.

**Resultado del Gate**: **PASS** (0 violaciones a la Constitución `v2.0.0`).

## Project Structure

### Documentation (this feature)

```text
specs/001-asisconexion-mvp/
├── plan.md                              # Este plan de implementación técnica (v2)
├── research.md                          # Decisiones arquitectónicas y pruebas reales contra Render
├── data-model.md                        # Modelo relacional único (ASISCONEXION_DB), 11 entidades y máquina de estados
├── quickstart.md                        # Guía de entorno, modo Mock LSP y smoke tests v2
├── contracts/
│   ├── openapi.yaml                     # Contrato completo OpenAPI 3.1 (v2)
│   └── external-integrations.md         # Contratos DIP/LSP/OCP (IExternalAuthAdapter, IContentRule, IAssistantEngineProvider)
├── checklists/
│   └── requirements.md                  # Validación de calidad de la especificación
└── tasks.md                             # Desglose de tareas actualizado para v2
```

### Source Code (repository root)

```text
src/
├── main.ts                                 # Bootstrap, ValidationPipe, CORS, /v1 y Swagger (/api/docs)
├── app.module.ts                           # Módulo raíz del Monolito Modular
├── config/
│   └── env.validation.ts                   # Validación tipada (DB_LOCAL_URL, RENDER_API_URL, JWT, cuotas anónimas, WhatsApp)
├── common/
│   ├── decorators/                         # @CurrentSession(), @Roles()
│   ├── filters/                            # AllExceptionsFilter (estándar RFC 7807 application/problem+json)
│   ├── guards/                             # DeviceSessionGuard, RolesGuard (verifica ADMIN en external_roles o MODERATOR en local_role)
│   └── dto/                                # PaginationQueryDto, PaginatedResponseDto (RT-01)
├── database/                               # DatabaseModule (Conexión Única PostgreSQL a ASISCONEXION_DB)
│   ├── database.module.ts                  # Configura 'default' (ASISCONEXION_DB)
│   └── migrations/                         # Migraciones versionadas de ASISCONEXION_DB (incluyendo evolución v2)
└── modules/
    ├── auth-session/                       # AuthSessionModule (/v1/auth, /v1/sessions, /v1/actors, /v1/connections)
    │   ├── dto/
    │   ├── entities/
    │   │   ├── user-account.entity.ts      # external_user_id (int), external_roles (text[]), local_role
    │   │   ├── actor.entity.ts             # Perfil 1:1 para usuarios registrados
    │   │   ├── actor-connection.entity.ts  # Solicitudes y conexiones entre Actors
    │   │   └── device-session.entity.ts    # Sesión local con consent_accepted_at
    │   ├── interfaces/
    │   │   ├── i-render-auth.adapter.ts    # Contrato unificado IExternalAuthAdapter (EXTERNAL_AUTH_ADAPTER)
    │   │   ├── i-local-user.repository.ts  # IUserSyncRepository
    │   │   └── i-actor.repository.ts       # Contrato DIP para perfiles Actor y conexiones
    │   ├── adapters/
    │   │   ├── render-auth.http-adapter.ts # Consume POST /auth/login, POST /auth/registro, GET /auth/perfil
    │   │   └── render-auth.mock-adapter.ts # Sustituto LSP para pruebas y desarrollo paralelo
    │   ├── repositories/
    │   │   ├── local-user.repository.ts
    │   │   └── actor.repository.ts
    │   ├── auth-session.controller.ts      # /v1/auth/login, /v1/auth/registro, /v1/sessions/anonymous
    │   ├── actors.controller.ts            # /v1/actors/me, /v1/actors/:id, /v1/connections
    │   ├── auth-session.service.ts
    │   ├── actors.service.ts
    │   └── auth-session.module.ts
    ├── social/                             # SocialModule (/v1/categories, /v1/posts, /v1/comments)
    │   ├── dto/                            # DTOs con media_urls[], parent_id y reacciones a comentarios
    │   ├── entities/                       # category.entity.ts, post.entity.ts, post-media.entity.ts, comment.entity.ts, reaction.entity.ts, comment-reaction.entity.ts
    │   ├── interfaces/                     # Contratos DIP de repositorios sociales
    │   ├── repositories/                   # category.repository.ts, post.repository.ts, comment.repository.ts, reaction.repository.ts
    │   ├── controllers/                    # categories.controller.ts, posts.controller.ts
    │   ├── services/                       # categories.service.ts, posts.service.ts (invoca ContentFilterService y aplica cuota anónima)
    │   └── social.module.ts
    ├── moderation/                         # ModerationModule (/v1/admin/moderation, /v1/admin/moderators)
    │   ├── dto/                            # pending-query.dto.ts, update-moderation-status.dto.ts, moderator-role.dto.ts
    │   ├── interfaces/                     # i-moderation.repository.ts, i-content-rule.interface.ts
    │   ├── rules/                          # profanity.rule.ts, external-link.rule.ts, minor-data.rule.ts, spam.rule.ts
    │   ├── content-filter.service.ts       # Filtro automático OCP (evalúa IContentRule[])
    │   ├── moderation.service.ts           # Cola PENDING/APPROVED/REJECTED y gestión de MODERATOR
    │   ├── repositories/                   # moderation.repository.ts
    │   ├── moderation.controller.ts        # Rutas de moderación (ADMIN|MODERATOR) y gestión de moderadores (solo ADMIN)
    │   └── moderation.module.ts
    ├── directory/                          # DirectoryModule (/v1/directory)
    └── assistant/                          # AssistantModule (/v1/assistant — FaqRuleEngineProvider detrás de IAssistantEngineProvider)
```

**Structure Decision**: Se mantiene el Monolito Modular en `src/`, eliminando `src/database/external-entities/` y `GlobalUserRepository` (`FOUNDATION_GLOBAL_DB`), eliminando `rag-multimodal.provider.stub.ts`, unificando el adaptador externo en `IExternalAuthAdapter`, agregando `Actor` y `ActorConnection` dentro del dominio de identidad/perfiles (`AuthSessionModule`), ampliando `SocialModule` con `PostMedia`, hilos en `Comment` y `CommentReaction`, e incorporando `ContentFilterService` (`IContentRule`) y la gestión de moderadores en `ModerationModule`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Ninguna | N/A | N/A |
