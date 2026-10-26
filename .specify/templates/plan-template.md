# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., TypeScript 5.x (strict mode, zero `any`) on Node.js LTS or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., NestJS, TypeORM, `@nestjs/swagger`, `@nestjs/axios`, `class-validator`, `class-transformer` or NEEDS CLARIFICATION]

**Storage**: [Dual PostgreSQL (`ASISCONEXION_DB` primary + `FOUNDATION_GLOBAL_DB` read/cross-check) + HTTP integration with `RENDER_AUTH_API_URL` or N/A]

**Testing**: [e.g., Jest + Supertest with LSP-compliant `Mocks` for Render/DB adapters or NEEDS CLARIFICATION]

**Target Platform**: [e.g., Linux server / container serving Web and entry-level mobile clients or NEEDS CLARIFICATION]

**Project Type**: [Monolito Modular en NestJS (`web-service`) or NEEDS CLARIFICATION]

**Performance Goals**: [RT-01: Mandatory pagination on all list endpoints and lightweight JSON payloads for entry-level mobile & Web]

**Constraints**: [RFC 7807 error format via `ExceptionFilters`, RN-02 human moderation (`PENDING` -> `APPROVED`), Ley 1581/1098 `consent_accepted_at`, zero exposure of `clave`/internal tokens]

**Scale/Scope**: [domain-specific, e.g., modules impacted (`Auth`, `Social`, `Directory`, `AssistantModule`) or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [ ] **I. Monolito Modular & SDD OpenAPI-First**: Los contratos DTO y decoradores `@nestjs/swagger` están especificados antes de codificar lógica de negocio y respetan límites modulares en NestJS + TypeScript.
- [ ] **II. Persistencia Dual & Consistencia con Render**: Se delimitan las responsabilidades entre `RENDER_AUTH_API_URL` (`@nestjs/axios`), `FOUNDATION_GLOBAL_DB` (lectura/verificación) y `ASISCONEXION_DB` (persistencia principal), garantizando persistencia local antes de emitir tokens de sesión.
- [ ] **III–V. Principios SOLID (`SRP`, `OCP`, `LSP`, `ISP`, `DIP`)**: Capas separadas (`*.controller.ts`, `*.service.ts`, `*.adapter.ts`, `*.repository.ts`), interfaces inyectadas por tokens NestJS (`IExternalAuthAdapter`/`IRenderAuthClient`, `IUserSyncRepository`, `IAssistantEngineProvider`) sustituibles por `Mocks`, `AssistantModule` extensible (`FaqRuleEngineProvider` -> `RagMultimodalProvider`), y DTOs segregados sin exponer `clave` ni tokens internos.
- [ ] **Clean Code, RFC 7807 & Rendimiento (RT-01)**: Prohibición total de `any`, validación con `class-validator`/`class-transformer`, `ExceptionFilters` devolviendo RFC 7807 (`BadGatewayException`/`ConflictException` ante fallos de Render) y paginación obligatoria con JSON ligero en listados.
- [ ] **Seguridad, Moderación (RN-02) & Cumplimiento Legal (Colombia)**: Todo `Post` y `Comment` se crea con `status = 'PENDING'` y solo se expone `status = 'APPROVED'`; registro obligatorio de `consent_accepted_at` (Ley 1581 de 2012 y Ley 1098) en sesiones e imágenes de menores/beneficiarios.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: NestJS Modular Monolith (DEFAULT — AsisConexión Backend)
src/
├── common/
│   ├── filters/         # RFC 7807 ExceptionFilters
│   ├── dto/             # Shared pagination DTOs (RT-01)
│   └── database/        # Dual TypeORM configs (ASISCONEXION_DB, FOUNDATION_GLOBAL_DB)
├── modules/
│   └── [feature-module]/
│       ├── controllers/ # *.controller.ts (HTTP routes, DTO validation, @nestjs/swagger only)
│       ├── services/    # *.service.ts (domain business rules & sync orchestration)
│       ├── adapters/    # *.adapter.ts (HTTP calls to RENDER_AUTH_API_URL)
│       ├── repositories/# *.repository.ts (TypeORM ops on ASISCONEXION_DB / FOUNDATION_GLOBAL_DB)
│       ├── dto/         # Segregated public, Render, and moderation DTOs (ISP)
│       ├── entities/    # TypeORM entities
│       └── interfaces/  # DIP tokens & contracts (+ Mock providers for LSP)
└── main.ts

test/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
└── src/                 # [same NestJS Modular Monolith layout as Option 1]

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same NestJS Modular Monolith layout as Option 1]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., Additional external service] | [current need] | [why existing Render/Dual-DB topology is insufficient] |
| [e.g., Cross-module event bus] | [specific problem] | [why direct DI interface call within modular monolith is insufficient] |
