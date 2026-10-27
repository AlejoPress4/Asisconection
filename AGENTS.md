<!-- SPECKIT START -->
Active implementation plan: `specs/001-asisconexion-mvp/plan.md` (Branch: `001-asisconexion-mvp`).
Read `specs/001-asisconexion-mvp/plan.md`, `specs/001-asisconexion-mvp/data-model.md`,
`specs/001-asisconexion-mvp/contracts/openapi.yaml`, and `specs/001-asisconexion-mvp/quickstart.md`
for technology stack (NestJS + TypeScript strict + Single TypeORM PostgreSQL `ASISCONEXION_DB` + `@nestjs/axios` + `@nestjs/swagger`),
modular directory structure (`src/`), and verification commands (`npm run lint`, `npm run test`, `npm run test:e2e`).
<!-- SPECKIT END -->

## Gobernanza Constitucional (AsisConexión Backend)

La fuente de verdad normativa del repositorio es `.specify/memory/constitution.md` (v2.0.0). Todo diseño, especificación, plan de implementación, desglose de tareas y código debe cumplir sin excepción:

1. **Monolito Modular & SDD OpenAPI-First**: NestJS + TypeScript estricto (prohibido `any`). Definir contratos DTO (`class-validator`, `class-transformer`) y decoradores `@nestjs/swagger` **antes** de codificar lógica de negocio.
2. **Persistencia Única (`ASISCONEXION_DB`) + Servicio Central de Identidad HTTP (`RENDER_AUTH_API_URL`)**: Sin conexión directa a `FOUNDATION_GLOBAL_DB`. Toda validación de identidad fluye por HTTP (`POST /auth/login`, `POST /auth/registro`, `GET /auth/perfil`) hacia Render/Supabase a través de `IExternalAuthAdapter`. Persistir en `ASISCONEXION_DB` (`UserAccount`, `Actor`, `ActorConnection`, `DeviceSession`, `Category`, `Post`, `PostMedia`, `Comment`, `Reaction`, `CommentReaction`, `RedirectionLink`, `FaqKnowledge`) antes de emitir tokens de sesión local (`device_token`).
3. **SOLID Obligatorio**: Aislar `*.controller.ts`, `*.service.ts`, `*.adapter.ts` y `*.repository.ts` (SRP); `AssistantModule` con `FaqRuleEngineProvider` detrás de `IAssistantEngineProvider` (sin RAG en Fase 2) y `ContentFilterService` extensible vía `IContentRule` (OCP); interfaces y tokens NestJS (`IExternalAuthAdapter`, `IUserSyncRepository`, `IAssistantEngineProvider`, `IContentRule`) sustituibles por `Mocks` (LSP/DIP); DTOs segregados sin exponer jamás `clave` ni tokens internos (ISP).
4. **Calidad y Rendimiento (RT-01)**: Manejo de errores homologado RFC 7807 vía `ExceptionFilters` (`UnauthorizedException` 401, `ConflictException` 409, `BadGatewayException` 502 ante fallos o rate-limit de Render); paginación obligatoria, multimedia exclusivamente mediante URLs y respuestas JSON ligeras en todos los listados.
5. **Moderación en Dos Capas (Filtro Automático + RN-02), Roles (`ADMIN` / `MODERATOR`) y Cumplimiento Legal (Colombia)**: Todo `Post` y `Comment` pasa primero por `ContentFilterService` (groserías, enlaces externos, datos de menores, spam -> `REJECTED` con `rejection_reason = 'AUTO_FILTER'`); si pasa, nace en `status = 'PENDING'` para revisión humana por `ADMIN` o `MODERATOR` global (asignado solo por `ADMIN`), y públicamente solo se expone `status = 'APPROVED'`. Registro obligatorio de `consent_accepted_at` conforme a Ley 1581 de 2012 y Ley 1098 de 2006.
