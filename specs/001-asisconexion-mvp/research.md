# Phase 0 Research: AsisConexión MVP — Backend Monolito Modular con Persistencia Dual

**Feature**: `001-asisconexion-mvp`
**Date**: 2026-10-25
**Status**: Complete (0 unresolved clarifications)

---

## 1. Conexión Simultánea a Dos Bases de Datos PostgreSQL en NestJS + TypeORM

- **Decision**: Configurar `DatabaseModule` con dos instancias nombradas de `TypeOrmModule.forRootAsync`:
  1. Conexión por defecto (`name: 'default'`) apuntando a `ASISCONEXION_DB` (`DB_LOCAL_URL`) con permisos de lectura/escritura, migraciones versionadas (`migrationsRun: false` en arranque automático, ejecutadas por CLI) y `synchronize: false`.
  2. Conexión secundaria (`name: 'global_db'`) apuntando a `FOUNDATION_GLOBAL_DB` (`DB_GLOBAL_URL`) en modo **estrictamente solo lectura**, mapeando únicamente `GlobalUserViewEntity` (`synchronize: false`, `migrationsRun: false`) e inyectada exclusivamente en `GlobalUserRepository` mediante `@InjectDataSource('global_db')`.
- **Rationale**: Aísla físicamente el ciclo de vida de esquemas propios (`ASISCONEXION_DB`) respecto a la base maestra fundacional (`FOUNDATION_GLOBAL_DB`), impidiendo mutaciones accidentales sobre tablas externas y respetando el principio SRP/DIP mediante `IGlobalUserRepository`.
- **Alternatives considered**:
  - *Foreign Data Wrapper (`postgres_fdw`) en una sola conexión*: Descartado porque requiere privilegios de superusuario sobre PostgreSQL gestionado y acopla la disponibilidad del arranque de migraciones locales a la red de la BD general.
  - *Consultas SQL crudas con `pg.Pool` manual*: Descartado por perder tipado estricto, manejo homogéneo de pools y facilidad de sustitución limpia por `Mocks` en NestJS DI.

---

## 2. Consistencia entre API Central en Render, `FOUNDATION_GLOBAL_DB` y `ASISCONEXION_DB`

- **Decision**: Implementar una orquestación secuencial con confirmación local obligatoria antes de emitir credenciales en `AuthSessionService`:
  1. Validar DTO entrante (`accept_consent === true` obligatorio; sin `accept_consent` se rechaza con `400 Bad Request` antes de tocar red externa).
  2. Invocar `IRenderAuthAdapter.register({ username, email, clave, rol })` vía `@nestjs/axios` con timeout explícito (`5000 ms`) y sin reintentos ciegos en `POST` no idempotente.
  3. Consultar opcionalmente `IGlobalUserRepository.findByUsernameOrEmail(...)` en `FOUNDATION_GLOBAL_DB` para recuperar `external_user_id` y verificar rol maestro (`synced_with_global_db = true` cuando hay confirmación cruzada).
  4. Ejecutar una transacción atómica en `ASISCONEXION_DB` (`LocalUserRepository`) que hace *upsert* de `UserAccount` (jamás persiste `clave`) y crea/actualiza `DeviceSession` (`nickname = username`, `role_tag = rol`, `consent_accepted_at = NOW()`).
  5. Solo tras el `COMMIT` exitoso en `ASISCONEXION_DB`, firmar y retornar el JWT `device_token`.
- **Rationale**: Cumple la regla constitucional de transaccionalidad y consistencia eventual: si Render rechaza por duplicado se mapea a `409 ConflictException`; si Render cae o expira timeout se mapea a `502 BadGatewayException`; si falla la escritura local en `ASISCONEXION_DB`, la transacción revierte y **nunca** se entrega un `device_token` huérfano.
- **Alternatives considered**:
  - *Emitir el token de Render directamente al cliente*: Descartado porque infringe ISP/seguridad constitucional (no exponer tokens internos), impide sesiones anónimas por dispositivo y rompe integridad referencial local (`device_id` / `user_account_id`).
  - *Cola asíncrona (Outbox/BullMQ) para crear `UserAccount` después de emitir el JWT*: Descartado porque provocaría condiciones de carrera inmediatas cuando el cliente use el token recién emitido para crear un `Post` o `Reaction`.

---

## 3. Autenticación Híbrida por Dispositivo (`DeviceSessionGuard`) y Autorización Administrativa (`RolesGuard`)

- **Decision**:
  - Emitir JWT firmados localmente (`@nestjs/jwt`, algoritmo `HS256`) cuyo payload mínimo sea `{ sub: session.id, uid: userAccount?.id ?? null, role: session.role_tag ?? 'VISITANTE', typ: 'device_session' }`, persistiendo el token (o su identificador único) en `DeviceSession.device_token`.
  - `DeviceSessionGuard`: Extrae `Bearer <device_token>`, verifica firma JWT, carga la `DeviceSession` activa desde `ASISCONEXION_DB` (verificando que `consent_accepted_at IS NOT NULL` y, si tiene `user_account_id`, que `UserAccount.is_active === true`) e inyecta el contexto en `request.session` para `@CurrentSession()`.
  - `RolesGuard`: Para rutas decoradas con `@Roles('ADMIN')` (`/v1/admin/moderation/*`), exige `user_account_id` no nulo, verifica `UserAccount.rol === 'ADMIN'` y realiza verificación cruzada contra `IGlobalUserRepository` (`FOUNDATION_GLOBAL_DB`) para asegurar que el privilegio administrativo sigue vigente a nivel fundacional.
- **Rationale**: Soporta con un único mecanismo limpio tanto visitantes sin registro (`user_account_id = null`) como usuarios autenticados, y blinda el panel de moderación contra escalación de privilegios o cuentas revocadas en la Fundación.
- **Alternatives considered**:
  - *Dos guards separados para usuarios anónimos y registrados en `SocialModule`*: Descartado porque duplicaría lógica en endpoints compartidos (`/v1/posts`, `/v1/posts/:postId/comments`, `/v1/posts/:postId/reactions`).
  - *Confiar únicamente en el claim `role` del JWT para moderación*: Descartado porque incumpliría el requisito explícito de validar rol `ADMIN` contra `UserAccount` / `FOUNDATION_GLOBAL_DB`.

---

## 4. Manejo Homologado de Errores bajo Estándar RFC 7807 (`AllExceptionsFilter`)

- **Decision**: Implementar un `AllExceptionsFilter` global (`@Catch()`) que serializa cualquier `HttpException` o error no controlado con `Content-Type: application/problem+json` y estructura RFC 7807:
  `{ type, title, status, detail, instance, timestamp, errors? }`.
  Los errores de validación de `ValidationPipe` (`class-validator`) se transforman en `400 Bad Request` con arreglo estructurado `errors: [{ field, message }]`. Los errores de `@nestjs/axios` en `RenderAuthHttpAdapter` se traducen explícitamente a `ConflictException` (`409`) cuando Render responde `409`/`422` por usuario/correo existente, `UnauthorizedException` (`401`) en credenciales inválidas durante `sync-session`, y `BadGatewayException` (`502`) ante errores `5xx`, DNS o timeout, ocultando siempre URLs internas, headers y contraseñas en logs y respuestas.
- **Rationale**: Cumple la Constitución (Reglas de Clean Code y Calidad) y entrega al equipo de Frontend (React Native + Web) un contrato único y predecible de fallos.
- **Alternatives considered**:
  - *Formato por defecto de NestJS (`{ statusCode, message, error }`)*: Descartado por mandato constitucional expreso de RFC 7807.

---

## 5. Rendimiento para Dispositivos de Gama de Entrada (`RT-01`)

- **Decision**:
  - Estandarizar `PaginationQueryDto` (`page = 1`, `limit = 20`, máximo `limit = 50`) en **todos** los listados (`GET /v1/categories`, `GET /v1/posts`, `GET /v1/posts/:postId/comments`, `GET /v1/admin/moderation/pending`, `GET /v1/directory/links`, `GET /v1/assistant/faqs`).
  - Usar proyecciones explícitas (`QueryBuilder.select(...)`) e índices compuestos en PostgreSQL (`IDX_posts_status_category_created`, `IDX_comments_post_status_created`) evitando `EAGER` loading indiscriminado y excluyendo metadatos internos en DTOs públicos.
- **Rationale**: Reduce drásticamente el tamaño de payload JSON y el uso de RAM en teléfonos Android de gama de entrada con redes móviles inestables, cumpliendo `SC-004` (<2s).
- **Alternatives considered**:
  - *Cursor pagination pura*: Descartada como contrato único porque la especificación SDD define explícitamente `GET /v1/posts?categoryId={uuid}&page={n}&limit={m}`; con límites acotados (`<= 50`) e índices compuestos en `(status, category_id, created_at DESC)`, la paginación `page`/`limit` cumple holgadamente los objetivos del MVP.

---

## 6. Extensibilidad Abierta/Cerrada en `AssistantModule` (`OCP`) y Desarrollo Paralelo con `Mocks` (`LSP`)

- **Decision**:
  - Definir el token `ASSISTANT_ENGINE_PROVIDER` asociado a la interfaz `IAssistantEngineProvider` (`queryFaqs(filter)`, `getDisclaimer()`). En Fase 1 se enlaza `FaqRuleEngineProvider` (consulta categorizada/búsqueda sobre `FaqKnowledge` + disclaimer legal constante), e incluir `RagMultimodalProviderStub` para documentar y validar en compilación el punto de extensión hacia Fase 2 (`pgvector` + LLM) sin tocar `AssistantController` ni DTOs.
  - Soportar variables de entorno `USE_MOCK_EXTERNAL_AUTH` y `USE_MOCK_GLOBAL_DB` en `AuthSessionModule` para conmutar por configuración entre adaptadores reales (`RenderAuthHttpAdapter`, `GlobalUserRepository`) y proveedores `Mock` deterministas (`RenderAuthMockAdapter`, `GlobalUserMockRepository`) respetando exactamente los contratos JSON (LSP).
- **Rationale**: Desbloquea el trabajo simultáneo con Frontend y pruebas E2E aisladas incluso cuando Render o `FOUNDATION_GLOBAL_DB` no estén accesibles desde entornos locales de desarrollo.
- **Alternatives considered**:
  - *Mocks solo en archivos `*.spec.ts` de Jest*: Insuficiente para levantar un servidor local completo de integración para el equipo de Frontend cuando servicios externos estén en mantenimiento.

---

## 7. Armonización de Variables de Entorno (`env.validation.ts`)

- **Decision**: Validar variables al arranque usando `class-validator` + `class-transformer` en `src/config/env.validation.ts`, aceptando los nombres operativos definidos en el plan técnico y exponiendo configuración tipada coherente con la Constitución:
  - `DB_LOCAL_URL` -> Conexión principal `ASISCONEXION_DB`
  - `DB_GLOBAL_URL` -> Conexión de solo lectura `FOUNDATION_GLOBAL_DB`
  - `RENDER_API_URL` (con soporte de alias `RENDER_AUTH_API_URL`) -> Base URL del servicio central en Render
  - `JWT_SECRET`, `JWT_EXPIRES_IN` (default `'30d'` para sesiones persistentes por dispositivo)
  - `WHATSAPP_SUPPORT_URL` / `WHATSAPP_SUPPORT_PHONE` -> Canal humano para `/v1/assistant/escalate`
  - `USE_MOCK_EXTERNAL_SERVICES` (default `'false'`) -> Conmutador LSP para desarrollo local/paralelo
- **Rationale**: Falla rápido (*fail-fast*) al iniciar la aplicación si falta alguna credencial crítica y reconcilia sin ambigüedad la nomenclatura del plan técnico y de la Constitución.
- **Alternatives considered**:
  - *Lectura directa de `process.env` en servicios/adaptadores*: Descartado por violar DIP/tipado estricto y propiciar errores en tiempo de ejecución.
