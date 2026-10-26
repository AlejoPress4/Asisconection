<!-- SPECKIT START -->
Active implementation plan: `specs/001-asisconexion-mvp/plan.md` (Branch: `001-asisconexion-mvp`).
Read `specs/001-asisconexion-mvp/plan.md`, `specs/001-asisconexion-mvp/data-model.md`,
`specs/001-asisconexion-mvp/contracts/openapi.yaml`, and `specs/001-asisconexion-mvp/quickstart.md`
for technology stack (NestJS + TypeScript strict + Dual TypeORM PostgreSQL + `@nestjs/axios` + `@nestjs/swagger`),
modular directory structure (`src/`), and verification commands (`npm run lint`, `npm run test`, `npm run test:e2e`).
<!-- SPECKIT END -->

## Gobernanza Constitucional (AsisConexión Backend)

La fuente de verdad normativa del repositorio es `.specify/memory/constitution.md` (v1.0.0). Todo diseño, especificación, plan de implementación, desglose de tareas y código debe cumplir sin excepción:

1. **Monolito Modular & SDD OpenAPI-First**: NestJS + TypeScript estricto (prohibido `any`). Definir contratos DTO (`class-validator`, `class-transformer`) y decoradores `@nestjs/swagger` **antes** de codificar lógica de negocio.
2. **Persistencia Dual Activa + API Render**: Operación coordinada entre `RENDER_AUTH_API_URL` (`@nestjs/axios`), `FOUNDATION_GLOBAL_DB` (PostgreSQL lectura/verificación fundacional) y `ASISCONEXION_DB` (PostgreSQL principal: `UserAccount`, `DeviceSession`, `Category`, `Post`, `Comment`, `Reaction`, `RedirectionLink`, `FaqKnowledge`). Persistir en `ASISCONEXION_DB` antes de emitir tokens de sesión local.
3. **SOLID Obligatorio**: Aislar `*.controller.ts`, `*.service.ts`, `*.adapter.ts` y `*.repository.ts` (SRP); `AssistantModule` abierto a extensión (`FaqRuleEngineProvider` Fase 1 -> `RagMultimodalProvider` Fase 2) vía `IAssistantEngineProvider` (OCP); interfaces y tokens NestJS (`IExternalAuthAdapter`/`IRenderAuthClient`, `IUserSyncRepository`, `IAssistantEngineProvider`) sustituibles por `Mocks` (LSP/DIP); DTOs segregados sin exponer jamás `clave` ni tokens internos (ISP).
4. **Calidad y Rendimiento (RT-01)**: Manejo de errores homologado RFC 7807 vía `ExceptionFilters` (`BadGatewayException` / `ConflictException` ante fallos o rechazos de Render); paginación obligatoria y respuestas JSON ligeras en todos los listados.
5. **Moderación (RN-02) y Cumplimiento Legal (Colombia)**: Todo `Post` y `Comment` se crea con `status = 'PENDING'` y públicamente solo se expone `status = 'APPROVED'`; registro obligatorio de `consent_accepted_at` conforme a Ley 1581 de 2012 y Ley 1098 de 2006.
