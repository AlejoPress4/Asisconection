---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **NestJS Modular Monolith (AsisConexión Backend default)**: `src/common/`, `src/modules/<module>/`, `test/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below follow the AsisConexión NestJS Modular Monolith conventions - adjust based on plan.md structure

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit-tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/

  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create NestJS Modular Monolith structure per implementation plan
- [ ] T002 Initialize TypeScript strict configuration (prohibiting `any`) with NestJS, TypeORM, `@nestjs/swagger`, `@nestjs/axios`, `class-validator`, and `class-transformer`
- [ ] T003 [P] Configure ESLint (`@typescript-eslint/no-explicit-any: error`) and Prettier formatting

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [ ] T004 Setup dual PostgreSQL TypeORM connections (`ASISCONEXION_DB` primary + `FOUNDATION_GLOBAL_DB` read/cross-check) and migrations framework
- [ ] T005 [P] Implement `RENDER_AUTH_API_URL` HTTP adapter (`*.adapter.ts`) + `IRenderAuthClient`/`IExternalAuthAdapter` DI token and `Mock` provider (LSP/DIP)
- [ ] T006 [P] Configure global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`) and `@nestjs/swagger` OpenAPI bootstrap
- [ ] T007 [P] Implement global RFC 7807 `ExceptionFilter` (mapping Render failures/rejections cleanly to `502 BadGatewayException` / `409 ConflictException`)
- [ ] T008 [P] Create shared RT-01 pagination DTOs and base TypeORM entities (`UserAccount`, `DeviceSession` with `consent_accepted_at`)
- [ ] T009 Setup environment configuration validation (`RENDER_AUTH_API_URL`, `FOUNDATION_GLOBAL_DB`, `ASISCONEXION_DB`)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own, including Mock substitution for Frontend parallel integration]

### OpenAPI Contracts & Tests for User Story 1 (SDD Contract-First — MANDATORY DTOs/Swagger before business logic) ⚠️

> **NOTE: Define `@nestjs/swagger` contracts/segregated DTOs FIRST (never exposing `clave` or internal tokens). If tests are requested, write them FIRST and ensure they FAIL before implementation.**

- [ ] T010 [P] [US1] Define segregated public/internal DTOs (`class-validator`, `@nestjs/swagger`, RT-01 pagination) in `src/modules/[module]/dto/[name].dto.ts`
- [ ] T011 [P] [US1] Define DI interfaces & `Mock` providers (`LSP`/`DIP`) in `src/modules/[module]/interfaces/[name].interface.ts`
- [ ] T012 [P] [US1] (Optional if requested) Contract/E2E test for OpenAPI schema & RFC 7807 errors in `test/contract/[name].e2e-spec.ts`

### Implementation for User Story 1

- [ ] T013 [P] [US1] Create TypeORM entity in `src/modules/[module]/entities/[entity].entity.ts` (enforcing `consent_accepted_at` or `status = 'PENDING'` where applicable)
- [ ] T014 [P] [US1] Implement repository (`SRP`) in `src/modules/[module]/repositories/[name].repository.ts`
- [ ] T015 [P] [US1] (If external HTTP needed) Implement external adapter (`SRP`) in `src/modules/[module]/adapters/[name].adapter.ts`
- [ ] T016 [US1] Implement domain service (`SRP`/`DIP`) in `src/modules/[module]/services/[name].service.ts` (orchestrating dual-DB sync, RN-02 `PENDING`/`APPROVED`, Ley 1581/1098 consent)
- [ ] T017 [US1] Implement controller (`SRP` — routes, DTOs, `@nestjs/swagger` decorators only) in `src/modules/[module]/controllers/[name].controller.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional, compliant with OpenAPI/SOLID/RN-02/RT-01, and testable independently

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### OpenAPI Contracts & Tests for User Story 2 ⚠️

- [ ] T018 [P] [US2] Define segregated DTOs & `@nestjs/swagger` contract metadata in `src/modules/[module]/dto/[name].dto.ts`
- [ ] T019 [P] [US2] (Optional if requested) Integration test in `test/integration/[name].spec.ts`

### Implementation for User Story 2

- [ ] T020 [P] [US2] Create TypeORM entity & repository in `src/modules/[module]/`
- [ ] T021 [US2] Implement domain service via NestJS DI tokens in `src/modules/[module]/services/[name].service.ts`
- [ ] T022 [US2] Implement controller with `@nestjs/swagger` contract in `src/modules/[module]/controllers/[name].controller.ts`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### OpenAPI Contracts & Tests for User Story 3 ⚠️

- [ ] T023 [P] [US3] Define segregated DTOs & `@nestjs/swagger` contract metadata in `src/modules/[module]/dto/[name].dto.ts`
- [ ] T024 [P] [US3] (Optional if requested) Integration test in `test/integration/[name].spec.ts`

### Implementation for User Story 3

- [ ] T025 [P] [US3] Create TypeORM entity / provider (e.g., `FaqRuleEngineProvider` behind `IAssistantEngineProvider` for OCP) in `src/modules/[module]/`
- [ ] T026 [US3] Implement domain service in `src/modules/[module]/services/[name].service.ts`
- [ ] T027 [US3] Implement controller in `src/modules/[module]/controllers/[name].controller.ts`

**Checkpoint**: All user stories should now be independently functional

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentation updates in docs/
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Performance optimization across all stories
- [ ] TXXX [P] Additional unit tests (if requested) in tests/unit/
- [ ] TXXX Security hardening
- [ ] TXXX Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- `@nestjs/swagger` OpenAPI contracts & segregated DTOs MUST be defined BEFORE business logic (SDD Contract-First)
- Tests (if included) MUST be written and FAIL before implementation
- Entities, DI interfaces (`Mocks`), external adapters (`*.adapter.ts`), and repositories (`*.repository.ts`) before domain services (`*.service.ts`)
- Domain services before controllers (`*.controller.ts`)
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (and Frontend can integrate against LSP `Mocks` immediately after OpenAPI DTO contracts)
- All contract/DTO definitions, entities, adapters, and repositories within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch OpenAPI DTO contracts & DI/Mock interfaces for User Story 1 together:
Task: "Define segregated public/internal DTOs in src/modules/[module]/dto/[name].dto.ts"
Task: "Define DI interfaces & Mock providers in src/modules/[module]/interfaces/[name].interface.ts"

# Launch TypeORM entity, repository, and external adapter in parallel:
Task: "Create TypeORM entity in src/modules/[module]/entities/[entity].entity.ts"
Task: "Implement repository in src/modules/[module]/repositories/[name].repository.ts"
Task: "Implement external adapter in src/modules/[module]/adapters/[name].adapter.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
