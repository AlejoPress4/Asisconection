# ADR-001: Arquitectura del Backend AsisConexión (Desde el Diseño Constitucional hasta la Integración Móvil)

- **Estado**: Aceptado e Implementado
- **Fecha**: 2026-11-08
- **Proyecto**: AsisConexión Backend (`Asisconnection` — NestJS + TypeScript estricto + TypeORM PostgreSQL `ASISCONEXION_DB`)
- **Fuente Normativa**: `.specify/memory/constitution.md` (v2.0.0) y `specs/001-asisconexion-mvp/contracts/openapi.yaml`

---

## 1. Contexto yProblema

El backend de **AsisConexión** provee la plataforma social comunitaria, de orientación (Asistente FAQ) y de articulación del ecosistema para la **Fundación ASISCO UP** (personas con síndrome de Down, menores de edad, acudientes, voluntarios e inversores).

Desde su inicio, el sistema debió responder a cinco restricciones arquitectónicas y legales críticas:
1. **Identidad centralizada externa**: La autenticación institucional del ecosistema reside en un servicio HTTP externo desplegado en Render (`RENDER_AUTH_API_URL`), sin acceso directo por base de datos a `FOUNDATION_GLOBAL_DB`.
2. **Protección reforzada de menores y datos sensibles (Colombia)**: Cumplimiento estricto de la **Ley 1581 de 2012** (Habeas Data) y la **Ley 1098 de 2006** (Código de la Infancia y la Adolescencia), exigiendo trazabilidad del consentimiento informado (`consent_accepted_at`) y moderación previa obligatoria antes de exponer cualquier contenido público.
3. **Rendimiento móvil en redes variables (RT-01)**: Respuestas JSON ligeras, paginación obligatoria (`{ data, meta }`), multimedia exclusivamente por referencias URL y manejo de errores estandarizado bajo **RFC 7807 (`ProblemDetails`)**.
4. **Principios SOLID y Especificación Primero (SDD OpenAPI-First)**: Contratos DTO validados con `class-validator` y documentados con `@nestjs/swagger` antes de la lógica de negocio, con inversión de dependencias mediante tokens de NestJS para permitir pruebas deterministas sin red externa.
5. **Trazabilidad extremo a extremo con la App Móvil (`Frontend-Asisconnection`)**: Proveer todos los atributos y endpoints requeridos por las pantallas móviles (Foro, Comentarios anidados, Reacciones, Perfil propio y público, Notificaciones, Asistente y Directorio del Ecosistema).

---

## 2. Decisiones Arquitectónicas (Desde el Inicio hasta la Integración con el Frontend)

### Decisión 1: Monolito Modular NestJS bajo SDD OpenAPI-First
- **Qué se decidió**: Estructurar el backend en módulos cohesivos dentro de `src/modules/`:
  - `auth-session`: Autenticación delegada, sincronización local (`UserAccount`, `Actor`, `DeviceSession`) y grafo social (`ActorConnection`).
  - `social`: Categorías (`Category`), publicaciones (`Post`, `PostMedia`), comentarios anidados (`Comment`), reacciones (`Reaction`, `CommentReaction`) y notificaciones recientes.
  - `moderation`: Motor extensible de filtrado automático (`ContentFilterService` + reglas `IContentRule`) y cola de moderación humana (`ADMIN` / `MODERATOR`).
  - `assistant`: Motor determinista de preguntas frecuentes (`FaqRuleEngineProvider` detrás de `IAssistantEngineProvider`) y escalamiento directo a WhatsApp.
  - `directory`: Catálogo paginado de módulos satélites (`RedirectionLink`).
- **Por qué**: Aísla responsabilidades (`Controller` → `Service` → `Repository` / `Adapter`), facilita el mantenimiento y garantiza que cada endpoint esté respaldado por DTOs estrictos (`whitelist: true`, `forbidNonWhitelisted: true`).

### Decisión 2: Persistencia Única (`ASISCONEXION_DB`) + Adaptador HTTP de Identidad (`IExternalAuthAdapter`)
- **Qué se decidió**: Prohibir conexiones directas a bases de datos externas. Toda validación de credenciales (`POST /auth/login`, `POST /auth/registro`, `GET /auth/perfil`) se realiza por HTTP mediante `RenderAuthAdapter` (implementando `IExternalAuthAdapter`). Antes de emitir el JWT local (`device_token`), el backend sincroniza transaccionalmente `UserAccount`, asegura el perfil 1:1 `Actor` y registra `DeviceSession` con `consent_accepted_at` en `ASISCONEXION_DB`.
- **Por qué**: Desacopla la disponibilidad de los foros locales de la base de datos global, traduce fallos o límites de tasa (`429`) del servicio central en respuestas controladas `502 Bad Gateway` (RFC 7807) y permite ejecutar pruebas automatizadas inyectando `MockExternalAuthAdapter`.

### Decisión 3: Moderación en Dos Capas (Filtro Automático OCP + Moderación Humana RN-02)
- **Qué se decidió**: Ningún `Post` ni `Comment` se publica directamente en estado `APPROVED`:
  1. **Capa 1 (`ContentFilterService` — Principio Abierto/Cerrado OCP)**: Evalúa el contenido contra una colección inyectable de reglas `IContentRule` (`ProfanityContentRule`, `ExternalLinkContentRule`, `MinorDataContentRule`, `SpamContentRule`). Si infringe alguna regla, se persiste inmediatamente con `status = 'REJECTED'` y `rejection_reason = 'AUTO_FILTER'`.
  2. **Capa 2 (Revisión Humana RN-02)**: Si supera el filtro automático, nace con `status = 'PENDING'` hasta que un `ADMIN` o `MODERATOR` global lo apruebe (`PATCH /v1/admin/moderation/.../status`).
  3. **Exposición Pública Segura**: `GET /v1/posts`, `GET /v1/actors/me/posts` y `GET /v1/posts/:postId/comments` filtran estrictamente por `status = 'APPROVED'`.

### Decisión 4: Uso de `LEFT JOIN` en Consultas Sociales (`PostRepository` y `CommentRepository`)
- **Qué se decidió**: Las proyecciones de publicaciones y comentarios utilizan `LEFT JOIN` hacia `user_accounts`, `actors` y `device_sessions`.
- **Por qué**: El modelo de dominio soporta tanto usuarios registrados (`user_account_id != null`, con perfil `Actor`) como sesiones de dispositivos invitados (`user_account_id IS NULL`, identificadas por `device_sessions.nickname` y `role_tag`). Un `INNER JOIN` descartaría las publicaciones o comentarios de sesiones anónimas; `LEFT JOIN` preserva ambos tipos de autores y permite a `buildAuthorBadge` construir el sello del autor de forma uniforme.

### Decisión 5: Enriquecimiento de Contratos y Nuevos Endpoints para Integración con el Frontend Móvil
Durante la conexión con el repositorio móvil (`Frontend-Asisconnection`), se incorporaron las siguientes mejoras manteniendo compatibilidad hacia atrás:
1. **Enriquecimiento de `AuthorBadgeDto`**: Se agregaron `actor_id` y `avatar_url` obtenidos desde la entidad `Actor` en las consultas de `PostRepository` y `CommentRepository`, permitiendo que la app móvil muestre avatares reales y navegue al perfil del autor.
2. **Endpoint `GET /v1/posts/:postId/comments`**: Listado paginado de comentarios aprobados de una publicación con conteo de reacciones (`likes_count`) y soporte de hilos (`parent_id`).
3. **Enriquecimiento de `GET /v1/actors/me` y creación de `GET /v1/actors/me/posts`**:
   - `/v1/actors/me` expone `email` **exclusivamente al propio titular** de la sesión (protegiendo la privacidad en `/v1/actors/:id` donde `email` jamás se incluye) junto con los contadores reales `posts_count`, `followers_count` y `following_count`.
   - `/v1/actors/me/posts` reutiliza la tubería de `listApproved` filtrada por el `userAccountId` de la sesión autenticada.
4. **Endpoints de Notificaciones (`GET /v1/notifications` y `PATCH /v1/notifications/read-all`)**:
   - Deriva notificaciones de actividad comunitaria reciente (comentarios aprobados de terceros en publicaciones propias dentro de los últimos 30 días) y permite marcarlas como leídas.

---

## 3. Seguridad y Cumplimiento Legal

- **Redacción recursiva de secretos**: `redactSensitiveFields` (`src/common/utils/redact.util.ts`) enmascara cualquier ocurrencia de `clave`, `password`, `authorization` o `device_token` antes de escribir logs.
- **Consentimiento estricto**: `preserveRawConsentValue` impide coerciones implícitas de cadenas a booleanos, exigiendo `accept_consent === true` en login, registro y sesiones anónimas, y bloqueando el adjunto de multimedia (`403 Forbidden`) si la sesión no cuenta con `consent_accepted_at`.

---

## 4. Verificación

- `npm run lint`: **0 errores y 0 advertencias** en `src/` y `test/`.
- `npm test`: **6/6 pruebas unitarias en verde** verificando redacción de campos sensibles, validación de variables de entorno, `FaqRuleEngineProvider`, `ContentFilterService` (OCP), `buildAuthorBadge` y `PostsService` (`listApprovedComments`, `listNotifications`, `markNotificationsRead`).
