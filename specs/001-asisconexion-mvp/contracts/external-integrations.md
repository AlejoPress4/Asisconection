# Contratos de Integración Externa e Inversión de Dependencias (v2 — SOLID DIP / LSP / OCP)

**Feature**: `001-asisconexion-mvp`
**Date**: 2026-10-27

---

## 1. Adaptador HTTP hacia el Servicio Central de Identidad en Render (`IExternalAuthAdapter`)

- **Token NestJS unificado**: `EXTERNAL_AUTH_ADAPTER` (`Symbol('EXTERNAL_AUTH_ADAPTER')`) — se mantiene alias `RENDER_AUTH_ADAPTER` apuntando al mismo símbolo para compatibilidad interna.
- **Ubicación**: `src/modules/auth-session/interfaces/i-render-auth.adapter.ts`
- **Base URL probada**: `https://proyecto-integrador-backend-g2.onrender.com` (Render con Supabase)
- **Implementaciones intercambiables (LSP)**:
  1. `RenderAuthHttpAdapter` (`@nestjs/axios`, producción/staging contra `RENDER_API_URL`)
  2. `RenderAuthMockAdapter` (desarrollo paralelo Frontend y suites de prueba cuando `USE_MOCK_EXTERNAL_SERVICES=true`)

### 1.1 Contrato Real Probado del Servicio Externo
| Endpoint | Entrada | Salida Exitosa | Error |
|----------|---------|----------------|-------|
| `POST /auth/login` | `{ email, clave }` | `200 { token: string, expiraEn: string, usuario: { usuarioId: number, username: string, email: string, fechaCreacion: string, roles: string[] } }` | `401/400 { error: "Correo o contraseña incorrectos" }` |
| `GET /auth/perfil` | `Authorization: Bearer <token>` | `200 { usuarioId: number, sesionId: number, username: string, roles: string[] }` | `401 { error: ... }` |
| `POST /auth/registro` | `{ username, email, clave, rol }` | Usuario creado / confirmación | `409/400 { error: ... }` |

> **Nota sobre Rate Limit**: El servicio externo aplica un límite de **20 peticiones cada 15 minutos**. Por ello, `AuthSessionService` valida contra el servicio externo **únicamente en `/v1/auth/login` y `/v1/auth/registro`**, sincroniza `UserAccount` + `Actor` en `ASISCONEXION_DB` y emite el `device_token` local para el resto de operaciones.

### 1.2 Interfaz TypeScript (`IExternalAuthAdapter`)
```ts
export interface ExternalAuthUserResult {
  readonly externalUserId: number;
  readonly username: string;
  readonly email: string;
  readonly roles: ReadonlyArray<string>;
  readonly primaryRole: string;
  readonly externalToken?: string;
  readonly expiresAt?: string;
}

export interface IExternalAuthAdapter {
  registerUser(payload: ExternalRegisterPayload): Promise<ExternalAuthUserResult>;
  loginUser(payload: ExternalLoginPayload): Promise<ExternalAuthUserResult>;
  getProfile?(externalToken: string): Promise<ExternalAuthUserResult>;
}
```

### 1.3 Mapeo Obligatorio de Errores hacia `AllExceptionsFilter` (RFC 7807)
- Credenciales inválidas (`401` o mensaje `"Correo o contraseña incorrectos"`) -> `UnauthorizedException` (`401`)
- Usuario o correo ya registrado en Supabase/Render (`409` o mensaje de duplicidad) -> `ConflictException` (`409`)
- Límite de tasa excedido (`429 Too Many Requests`), timeout (`> 5000ms`), `ECONNREFUSED` o `5xx` -> `BadGatewayException` (`502`)

---

## 2. Repositorio de Sincronización Local (`IUserSyncRepository`)

- **Token NestJS**: `USER_SYNC_REPOSITORY` (`Symbol('USER_SYNC_REPOSITORY')`)
- **DataSource**: `'default'` (`ASISCONEXION_DB`)
- **Responsabilidad transaccional**: Ejecutar en una sola transacción en `ASISCONEXION_DB` el *upsert* de `UserAccount` (`external_user_id` numérico, `external_roles[]`, preservando `local_role`), la creación o actualización 1:1 del perfil `Actor` (solo para usuarios registrados) y la creación/vinculación de `DeviceSession` (`consent_accepted_at` obligatorio) antes de firmar el `device_token`.

---

## 3. Reglas del Filtro Automático de Contenido (`IContentRule` — SOLID OCP)

- **Token NestJS**: `CONTENT_FILTER_RULES` (`Symbol('CONTENT_FILTER_RULES')`)
- **Ubicación**: `src/modules/moderation/interfaces/i-content-rule.interface.ts`
- **Contrato**:
  ```ts
  export interface ContentRuleEvaluation {
    readonly matched: boolean;
    readonly ruleName: string;
    readonly detail?: string;
  }

  export interface IContentRule {
    readonly name: string;
    evaluate(content: string): ContentRuleEvaluation;
  }
  ```
- **Reglas activas inyectadas en `ContentFilterService`**:
  1. `ProfanityContentRule`: Detecta groserías e insultos configurables.
  2. `ExternalLinkContentRule`: Detecta URLs o dominios externos (`http://`, `https://`, `www.`, etc.) en el texto de publicaciones y comentarios.
  3. `MinorDataContentRule`: Detecta patrones de datos sensibles de menores (números de documento/teléfono o combinaciones de referencias a menores con edades/datos de contacto).
  4. `SpamContentRule`: Detecta texto aleatorio, repetición excesiva de caracteres o exceso de mayúsculas.

---

## 4. Proveedor de Motor de Asistencia (`IAssistantEngineProvider` — SOLID OCP)

- **Token NestJS**: `ASSISTANT_ENGINE_PROVIDER` (`Symbol('ASSISTANT_ENGINE_PROVIDER')`)
- **Ubicación**: `src/modules/assistant/interfaces/i-assistant-engine.provider.ts`
- **Alcance v2**: Se mantiene la interfaz `IAssistantEngineProvider` implementada por `FaqRuleEngineProvider` sobre `FaqKnowledge` en `ASISCONEXION_DB`, y se retira el stub/alcance de RAG (`RagMultimodalProviderStub`) por decisión presupuestal.
