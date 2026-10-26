# Contratos de Integración Externa e Inversión de Dependencias (SOLID — DIP / LSP / OCP)

**Feature**: `001-asisconexion-mvp`
**Date**: 2026-10-25

---

## 1. Adaptador HTTP hacia API Central en Render (`IRenderAuthAdapter` / `IRenderAuthClient`)

- **Token NestJS**: `RENDER_AUTH_ADAPTER` (`Symbol('RENDER_AUTH_ADAPTER')`)
- **Ubicación**: `src/modules/auth-session/interfaces/i-render-auth.adapter.ts`
- **Implementaciones intercambiables (LSP)**:
  1. `RenderAuthHttpAdapter` (`@nestjs/axios`, producción/staging contra `RENDER_API_URL` / `RENDER_AUTH_API_URL`)
  2. `RenderAuthMockAdapter` (desarrollo paralelo Frontend y suites de prueba cuando `USE_MOCK_EXTERNAL_SERVICES=true`)

### 1.1 Operación `registerUser`
- **Endpoint externo**: `POST ${RENDER_API_URL}/auth/registro`
- **Payload estricto enviado (ISP)**:
  ```json
  {
    "username": "maria.acudiente",
    "email": "maria@prueba.com",
    "clave": "ClaveAcudiente2026",
    "rol": "ACUDIENTE"
  }
  ```
  *(Nota: `accept_consent` es exclusivo de AsisConexión y no se envía si el contrato de Render no lo admite).*
- **Resultado normalizado interno (`RenderUserResult`)**:
  ```ts
  export interface RenderUserResult {
    readonly externalUserId: string | null;
    readonly username: string;
    readonly email: string;
    readonly rol: string;
  }
  ```
- **Mapeo obligatorio de errores hacia `AllExceptionsFilter` (RFC 7807)**:
  - HTTP `409` / `400` por duplicidad en Render -> `ConflictException` (`409`)
  - Timeout (`> 5000ms`), `ECONNREFUSED`, `5xx` en Render -> `BadGatewayException` (`502`)

### 1.2 Operación `authenticateOrVerifyUser` (Soporte a `/v1/auth/sync-session`)
- Valida credenciales contra el endpoint de login de Render (`POST ${RENDER_API_URL}/auth/login`) y/o cruza lectura con `IGlobalUserRepository` según disponibilidad contractual, devolviendo `RenderUserResult` o lanzando `UnauthorizedException` (`401`) / `BadGatewayException` (`502`).

---

## 2. Repositorio de Lectura en `FOUNDATION_GLOBAL_DB` (`IGlobalUserRepository`)

- **Token NestJS**: `GLOBAL_USER_REPOSITORY` (`Symbol('GLOBAL_USER_REPOSITORY')`)
- **Ubicación**: `src/modules/auth-session/interfaces/i-global-user.repository.ts`
- **DataSource**: `'global_db'` (`FOUNDATION_GLOBAL_DB` — estrictamente `SELECT`)
- **Implementaciones intercambiables (LSP)**:
  1. `GlobalUserRepository` (TypeORM sobre `GlobalUserViewEntity`)
  2. `GlobalUserMockRepository` (semilla en memoria con usuarios `ACUDIENTE`, `ADMIN`, `VOLUNTARIO`)
- **Métodos del contrato**:
  ```ts
  export interface GlobalUserRecord {
    readonly id: string;
    readonly username: string;
    readonly email: string;
    readonly rol: string;
  }

  export interface IGlobalUserRepository {
    findByUsernameOrEmail(identifier: string): Promise<GlobalUserRecord | null>;
    verifyAdminRole(usernameOrEmail: string): Promise<boolean>;
  }
  ```

---

## 3. Repositorio de Sincronización Local (`IUserSyncRepository`)

- **Token NestJS**: `USER_SYNC_REPOSITORY` (`Symbol('USER_SYNC_REPOSITORY')`)
- **Ubicación**: `src/modules/auth-session/interfaces/i-local-user.repository.ts`
- **DataSource**: `'default'` (`ASISCONEXION_DB`)
- **Responsabilidad transaccional**: Ejecutar en una sola transacción local el *upsert* de `UserAccount` (sin `clave`) y la creación/vinculación de `DeviceSession` (`consent_accepted_at` obligatorio) antes de que `AuthSessionService` firme el `device_token`.

---

## 4. Proveedor de Motor de Asistencia (`IAssistantEngineProvider` — SOLID OCP)

- **Token NestJS**: `ASSISTANT_ENGINE_PROVIDER` (`Symbol('ASSISTANT_ENGINE_PROVIDER')`)
- **Ubicación**: `src/modules/assistant/interfaces/i-assistant-engine.provider.ts`
- **Contrato estable entre Fase 1 y Fase 2**:
  ```ts
  export interface AssistantFaqQuery {
    readonly category?: string;
    readonly page: number;
    readonly limit: number;
  }

  export interface AssistantFaqResult {
    readonly disclaimer: string;
    readonly items: ReadonlyArray<{
      readonly id: string;
      readonly question: string;
      readonly answer: string;
      readonly category: string;
    }>;
    readonly totalItems: number;
  }

  export interface IAssistantEngineProvider {
    resolveFaqs(query: AssistantFaqQuery): Promise<AssistantFaqResult>;
  }
  ```
- **Evolución sin modificar `AssistantController`**:
  - **Fase 1 (MVP activo)**: `FaqRuleEngineProvider` consulta `FaqKnowledgeRepository` en `ASISCONEXION_DB`.
  - **Fase 2 (Preparado)**: `RagMultimodalProviderStub` (`pgvector` + LLM) implementa exactamente `IAssistantEngineProvider` y se conmuta vía provider factory en `AssistantModule`.
