# Implementation Plan: AsisConexión MVP — Backend Monolito Modular con Persistencia Dual

**Branch**: `001-asisconexion-mvp` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-asisconexion-mvp/spec.md`

## Summary

Implementación del backend MVP de **AsisConexión** bajo una arquitectura de **Monolito Modular estricto en NestJS + TypeScript** guiada por contratos OpenAPI (`@nestjs/swagger` en `/api/docs`). El sistema coordina simultáneamente el servicio central de autenticación en Render (`RENDER_API_URL` vía `@nestjs/axios`), una conexión PostgreSQL de solo lectura hacia la base maestra fundacional (`FOUNDATION_GLOBAL_DB` / `global_db`) y una conexión PostgreSQL principal (`ASISCONEXION_DB` / `default`) donde persisten `UserAccount`, `DeviceSession` y los dominios de foros (`Category`, `Post`, `Comment`, `Reaction`), moderación administrativa (`RN-02`), directorio satélite sin superposición (`RedirectionLink`) y asistente orientativo (`FaqKnowledge` en Fase 1 con punto de extensión abierto `IAssistantEngineProvider` hacia RAG multimodal en Fase 2).

## Technical Context

**Language/Version**: TypeScript `5.x` (`strict: true`, `noImplicitAny: true`, prohibición absoluta de `any`) sobre Node.js `20 LTS`

**Primary Dependencies**: NestJS (`@nestjs/common`, `@nestjs/core`, `@nestjs/config`, `@nestjs/jwt`), `@nestjs/typeorm` + `typeorm` + `pg`, `@nestjs/swagger`, `@nestjs/axios` + `axios`, `class-validator`, `class-transformer`

**Storage**: Persistencia Dual PostgreSQL (`>= 15`): DataSource `'default'` lectura/escritura en `ASISCONEXION_DB` (`DB_LOCAL_URL`) + DataSource `'global_db'` estrictamente solo lectura en `FOUNDATION_GLOBAL_DB` (`DB_GLOBAL_URL`), coordinados con `RENDER_API_URL` (`POST /auth/registro` y validación de sesión)

**Testing**: Jest (pruebas unitarias y de integración por módulo) + Supertest (pruebas E2E/contrato OpenAPI y RFC 7807) con `Mocks` intercambiables por configuración (`USE_MOCK_EXTERNAL_SERVICES`) cumpliendo LSP/DIP

**Target Platform**: Servidor Linux / contenedor Node.js sirviendo clientes móviles React Native (gama de entrada) y aplicación Web

**Project Type**: Monolito Modular Backend HTTP REST (`web-service`, prefijo `/v1`, Swagger en `/api/docs`)

**Performance Goals**: Cumplimiento `RT-01` y `SC-004`: paginación obligatoria en todos los listados (`page = 1`, `limit = 20`, máx. `50`), proyecciones SQL ligeras e índices compuestos para respuestas `< 2s` en redes móviles de gama de entrada

**Constraints**: Errores homologados RFC 7807 (`application/problem+json`) vía `AllExceptionsFilter` (`409 ConflictException` y `502 BadGatewayException` ante rechazos/fallos de Render), persistencia local confirmada en `ASISCONEXION_DB` antes de emitir `device_token`, moderación humana `RN-02` (`PENDING` al crear / solo `APPROVED` en público), trazabilidad legal `consent_accepted_at` (Ley 1581 de 2012 y Ley 1098 de 2006) y cero exposición de `clave` o tokens internos

**Scale/Scope**: 5 módulos de dominio (`AuthSessionModule`, `SocialModule`, `ModerationModule`, `DirectoryModule`, `AssistantModule`), 1 módulo transversal de persistencia dual (`DatabaseModule`), 9 entidades/vistas mapeadas y 14 operaciones HTTP documentadas en OpenAPI 3.1

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Evaluación Pre-Phase 0 y Re-evaluación Post-Phase 1

- [x] **I. Monolito Modular & SDD OpenAPI-First**: Los 14 contratos HTTP, esquemas DTO y códigos de error están formalizados previamente en `specs/001-asisconexion-mvp/contracts/openapi.yaml` y se exponen en `/api/docs` con `@nestjs/swagger` antes de codificar reglas de negocio.
- [x] **II. Persistencia Dual & Consistencia con Render**: `DatabaseModule` separa explícitamente `'default'` (`ASISCONEXION_DB`) y `'global_db'` (`FOUNDATION_GLOBAL_DB`, solo lectura sobre `GlobalUserViewEntity`), mientras `AuthSessionService` persiste transaccionalmente `UserAccount` + `DeviceSession` antes de firmar el `device_token`.
- [x] **III–V. Principios SOLID (`SRP`, `OCP`, `LSP`, `ISP`, `DIP`)**: Separación estricta entre `*.controller.ts`, `*.service.ts`, `*.adapter.ts` y `*.repository.ts`; tokens de inyección (`RENDER_AUTH_ADAPTER`, `GLOBAL_USER_REPOSITORY`, `USER_SYNC_REPOSITORY`, `ASSISTANT_ENGINE_PROVIDER`) con implementaciones `Mock` para desarrollo paralelo con Frontend; `AssistantModule` abierto a extensión (`FaqRuleEngineProvider` Fase 1 -> `RagMultimodalProviderStub` Fase 2); DTOs segregados donde `PublicUserDto` excluye `clave` y credenciales internas.
- [x] **Clean Code, RFC 7807 & Rendimiento (RT-01)**: Linter y `tsconfig` prohíben `any`; validación global con `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`); `AllExceptionsFilter` homologa todos los fallos a RFC 7807; `PaginationQueryDto` aplica paginación obligatoria y respuestas ligeras en todos los listados.
- [x] **Seguridad, Moderación (RN-02) & Cumplimiento Legal (Colombia)**: `CreatePostDto` y `CreateCommentDto` no admiten `status` y el servicio fuerza `status = 'PENDING'`; las consultas públicas filtran exclusivamente `status = 'APPROVED'`; `accept_consent: true` y `consent_accepted_at` se exigen en sesiones y publicaciones con imagen conforme a Ley 1581 de 2012 y Ley 1098 de 2006.

**Resultado del Gate**: **PASS** (0 violaciones constitucionales en Pre-Phase 0 y Post-Phase 1).

## Project Structure

### Documentation (this feature)

```text
specs/001-asisconexion-mvp/
├── plan.md                              # Este plan de implementación técnica
├── research.md                          # Decisiones arquitectónicas y patrones Phase 0
├── data-model.md                        # Modelo relacional dual, índices y máquina de estados
├── quickstart.md                        # Guía de entorno, modo Mock LSP y smoke tests
├── contracts/
│   ├── openapi.yaml                     # Contrato completo OpenAPI 3.1 (14 operaciones)
│   └── external-integrations.md         # Contratos DIP/LSP/OCP (Render, BD General, Assistant)
├── checklists/
│   └── requirements.md                  # Validación de calidad de la especificación
└── tasks.md                             # Se generará en Phase 2 mediante /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── main.ts                                 # Bootstrap, ValidationPipe, CORS, /v1 y Swagger (/api/docs)
├── app.module.ts                           # Módulo raíz del Monolito Modular
├── config/
│   └── env.validation.ts                   # Validación tipada (DB_LOCAL_URL, DB_GLOBAL_URL, RENDER_API_URL, JWT, WhatsApp)
├── common/
│   ├── decorators/                         # @CurrentSession(), @Roles()
│   ├── filters/                            # AllExceptionsFilter (estándar RFC 7807 application/problem+json)
│   ├── guards/                             # DeviceSessionGuard, RolesGuard (verificación ADMIN en BD Local + General)
│   └── dto/                                # PaginationQueryDto, PaginatedResponseDto (RT-01)
├── database/                               # DatabaseModule (Conexión Simultánea a 2 BDs PostgreSQL)
│   ├── database.module.ts                  # Configura 'default' (ASISCONEXION_DB) y 'global_db' (FOUNDATION_GLOBAL_DB)
│   ├── migrations/                         # Migraciones versionadas exclusivas de ASISCONEXION_DB
│   └── external-entities/
│       └── global-user.view-entity.ts      # Mapeo de solo lectura de external_user en FOUNDATION_GLOBAL_DB
└── modules/
    ├── auth-session/                       # AuthSessionModule (/v1/auth y /v1/sessions)
    │   ├── dto/
    │   │   ├── register-user.dto.ts        # { username, email, clave, rol, accept_consent }
    │   │   ├── sync-session.dto.ts         # Sincronización/login de usuario existente
    │   │   ├── init-anonymous.dto.ts       # { nickname?, role_tag?, accept_consent }
    │   │   └── auth-session-response.dto.ts# Segregado ISP (sin clave ni tokens internos)
    │   ├── entities/
    │   │   ├── user-account.entity.ts      # Persistida en ASISCONEXION_DB
    │   │   └── device-session.entity.ts    # Persistida en ASISCONEXION_DB
    │   ├── interfaces/
    │   │   ├── i-render-auth.adapter.ts    # DIP/LSP para consumo HTTP hacia Render
    │   │   ├── i-global-user.repository.ts # DIP/LSP para lectura en FOUNDATION_GLOBAL_DB
    │   │   └── i-local-user.repository.ts  # DIP/LSP para sincronización transaccional local
    │   ├── adapters/
    │   │   ├── render-auth.http-adapter.ts # Consume POST ${RENDER_API_URL}/auth/registro (@nestjs/axios)
    │   │   └── render-auth.mock-adapter.ts # Sustituto LSP para desarrollo paralelo con Frontend
    │   ├── repositories/
    │   │   ├── local-user.repository.ts    # DataSource: 'default' (ASISCONEXION_DB)
    │   │   ├── global-user.repository.ts   # DataSource: 'global_db' (FOUNDATION_GLOBAL_DB)
    │   │   └── global-user.mock-repository.ts
    │   ├── auth-session.controller.ts
    │   ├── auth-session.service.ts         # Orquesta registro/sync con Render, BD General y BD Propia
    │   └── auth-session.module.ts
    ├── social/                             # SocialModule (/v1/categories, /v1/posts)
    │   ├── dto/                            # DTOs de categorías, posts, comentarios y reacciones
    │   ├── entities/                       # category.entity.ts, post.entity.ts, comment.entity.ts, reaction.entity.ts
    │   ├── interfaces/                     # Contratos DIP de repositorios sociales
    │   ├── repositories/                   # category.repository.ts, post.repository.ts, comment.repository.ts, reaction.repository.ts
    │   ├── controllers/                    # categories.controller.ts, posts.controller.ts
    │   ├── services/                       # categories.service.ts, posts.service.ts (fuerza PENDING / filtra APPROVED)
    │   └── social.module.ts
    ├── moderation/                         # ModerationModule (/v1/admin/moderation)
    │   ├── dto/                            # pending-query.dto.ts, update-moderation-status.dto.ts
    │   ├── interfaces/                     # i-moderation.repository.ts
    │   ├── repositories/                   # moderation.repository.ts (aislamiento TypeORM SRP)
    │   ├── moderation.controller.ts
    │   ├── moderation.service.ts
    │   └── moderation.module.ts
    ├── directory/                          # DirectoryModule (/v1/directory)
    │   ├── dto/                            # redirection-link-response.dto.ts
    │   ├── entities/                       # redirection-link.entity.ts
    │   ├── interfaces/                     # i-redirection-link.repository.ts
    │   ├── repositories/                   # redirection-link.repository.ts (SRP)
    │   ├── directory.controller.ts
    │   ├── directory.service.ts
    │   └── directory.module.ts
    └── assistant/                          # AssistantModule (/v1/assistant — FAQ Fase 1 + RAG Fase 2)
        ├── dto/                            # faq-query.dto.ts, faq-response.dto.ts, escalate.dto.ts
        ├── entities/                       # faq-knowledge.entity.ts
        ├── interfaces/                     # i-assistant-engine.provider.ts, i-faq-knowledge.repository.ts
        ├── repositories/                   # faq-knowledge.repository.ts (SRP)
        ├── providers/
        │   ├── faq-rule-engine.provider.ts         # Motor activo Fase 1
        │   └── rag-multimodal.provider.stub.ts     # Punto de extensión OCP Fase 2 (pgvector + LLM)
        ├── assistant.controller.ts
        ├── assistant.service.ts
        └── assistant.module.ts

test/
├── unit/                                   # Pruebas aisladas de servicios, guards, filtros y providers con Mocks
├── integration/                            # Pruebas de repositorios y flujo transaccional dual
└── contract/                               # Pruebas E2E Supertest validando contratos OpenAPI, RFC 7807 y RN-02
```

**Structure Decision**: Se adopta la estructura de **Monolito Modular en NestJS** en la raíz del repositorio (`src/` y `test/`), respetando íntegramente el árbol definido para los 5 módulos de dominio y `DatabaseModule`, e incluyendo repositorios dedicados (`*.repository.ts`) e interfaces DI en cada módulo con persistencia para garantizar cumplimiento estricto de los principios SRP, LSP y DIP de la Constitución `v1.0.0`.

## Complexity Tracking

> **Sin violaciones al Constitution Check**: Toda la topología dual (`ASISCONEXION_DB` + `FOUNDATION_GLOBAL_DB` + `RENDER_API_URL`), el aislamiento en repositorios/adaptadores y los proveedores intercambiables responden directamente a mandatos explícitos de la Constitución `v1.0.0`.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Ninguna | N/A | N/A |
