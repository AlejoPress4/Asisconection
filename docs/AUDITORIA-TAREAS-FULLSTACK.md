# Auditoría y Matriz de Trazabilidad Full-Stack (`AsisConexión` Backend + Frontend) — 100% Completada

Documento maestro de auditoría, alineación de contratos y trazabilidad de extremo a extremo entre:
- **Backend (`Asisconnection`):** `CU-01..CU-05`, **`BK-01` a `BK-07`**, **aprobación directa de publicaciones y comentarios (`status = 'APPROVED'`)** y **`AL-01` a `AL-05`**.
- **Frontend (`Frontend-Asisconnection`):** `CU-01..CU-05`, `T-41`, **`AL-01` a `AL-05`** y **`FE-01` a `FE-07`**.

---

## 1. Matriz de Trazabilidad de Extremo a Extremo (Frontend ↔ Backend ↔ Base de Datos)

| Módulo / Caso de Uso | Pantalla / Servicio Frontend | Endpoint Backend (`/v1/...`) | Entidades `ASISCONEXION_DB` | Reglas de Negocio y Seguridad Aplicadas |
|---|---|---|---|---|
| **Autenticación, Registro y Sesión Invitado** | `LoginScreen.tsx`, `RegisterModal.tsx`, `authService.ts` | `POST /auth/login`<br>`POST /auth/registro`<br>`POST /sessions/anonymous`<br>`GET /sessions/me` | `user_accounts`<br>`actors`<br>`device_sessions` | Consentimiento Ley 1581/1098 obligatorio (`consent_accepted_at`); bloqueo de colisión de identidad (`BK-04`); enriquecimiento desde `GET /auth/perfil` (`BK-05`); bloqueo de rol `ADMIN` en registro (`BK-06`); migración de actividad al promover sesión anónima (`BK-07`). |
| **Perfiles, Privacidad Ley 1581 y Grafo Social (`CU-01`)** | `ProfileScreen.tsx`, `OtherProfileScreen.tsx`, `FollowersScreen.tsx`, `SettingsScreen.tsx`, `profileService.ts`, `publicProfileService.ts` | `GET /actors/me`<br>`PATCH /actors/me`<br>`GET /actors`<br>`GET /actors/:id`<br>`GET /actors/:id/followers`<br>`GET /actors/:id/following`<br>`GET /connections`<br>`POST /connections`<br>`PATCH /connections/:id`<br>`DELETE /connections/:id` | `actors`<br>`actor_connections`<br>`user_accounts` | Datos personales (`email`, `birth_date`, `city`) ocultos por defecto (`false`); sincronización de `local_role` (`AL-02`); limpieza `"" -> null`; seguimiento unidireccional (*follow-back*) y prioridad de relación saliente `OUTGOING` (`BK-03`). |
| **Foro, Búsqueda, Feed «Siguiendo» y Guardados (`CU-02`, `CU-04`)** | `ForumScreen.tsx`, `ForumPostCard.tsx`, `NewPostScreen.tsx`, `EditPostModal.tsx`, `forumService.ts`, `postsService.ts` | `GET /categories`<br>`GET /posts?feed=discover\|following&search=`<br>`GET /posts/:id`<br>`POST /posts`<br>`PATCH /posts/:id`<br>`DELETE /posts/:id`<br>`POST /posts/:postId/reactions`<br>`POST /posts/:postId/bookmarks`<br>`GET /bookmarks`<br>`GET /actors/me/submissions` | `categories`<br>`posts`<br>`post_media`<br>`reactions`<br>`post_bookmarks` | Filtro automático síncrono (`ContentFilterService`: groserías, links externos, datos de menores, spam -> `REJECTED` con `AUTO_FILTER`); **aprobación directa (`status = 'APPROVED'`)** para toda publicación limpia; categoría institucional `Noticias` restringida a `ADMIN`/`MODERATOR` (`BK-06`); reacciones y guardados trazables por `user_account_id OR device_id` (`BK-02`); `AuthorBadgeDto` con nombre completo, `username` y prioridad de rol (`AL-01`). |
| **Comentarios y Respuestas en Hilo (`CU-03`, `AL-03`)** | `CommentsScreen.tsx`, `CommentItem.tsx`, `commentsService.ts` | `GET /posts/:postId/comments`<br>`POST /posts/:postId/comments`<br>`DELETE /comments/:id`<br>`POST /comments/:id/reactions` | `comments`<br>`comment_reactions` | Filtro automático síncrono (`ContentFilterService`) y **aprobación directa (`status = 'APPROVED'`)** para todo comentario limpio; campo `liked_by_me` por usuario/dispositivo (`AL-03`); eliminación/rechazo en cascada de respuestas hijas (`BK-07`). |
| **Notificaciones Multievento (`AL-04`, `FE-05`)** | `NotificationsScreen.tsx`, `NotificationsPanel.tsx`, `notificationsService.ts` | `GET /notifications`<br>`PATCH /notifications/read-all` | `reactions`<br>`comments`<br>`comment_reactions`<br>`actor_connections`<br>`posts` | Eventos `LIKE_ON_POST`, `COMMENT_ON_POST`, `REPLY_TO_COMMENT`, `LIKE_ON_COMMENT`, `NEW_FOLLOWER` (diferenciando `PENDING` vs `ACCEPTED`) y `FOUNDATION_ANNOUNCEMENT`; metadatos enriquecidos (`actor_id`, `post_id`, `snippet`) y ventana de 30 días. |
| **Reportes Comunitarios y Moderación (`CU-05`, `BK-01`, `T-41`)** | `AdminScreen.tsx`, `ReportContentModal.tsx`, `FaqManagementSection.tsx`, `EcosystemManagementSection.tsx`, `adminService.ts` | `POST /reports`<br>`GET /admin/moderation/reports`<br>`PATCH /admin/moderation/reports/:id/resolve`<br>`GET /admin/moderation/pending`<br>`PATCH /admin/moderation/posts\|comments/:id/status`<br>`GET /admin/accounts`<br>`GET /admin/moderators`<br>`PUT\|DELETE /admin/moderators/:id`<br>`POST\|PATCH\|DELETE /admin/faqs`<br>`POST\|PATCH\|DELETE /admin/directory/links` | `content_reports`<br>`posts`<br>`comments`<br>`user_accounts`<br>`faq_knowledge`<br>`redirection_links` | Reportes comunitarios con control de duplicados (`409 Conflict`); resolución con opción de rechazo automático del contenido reportado; gestión de moderadores y CRUD de FAQs y enlaces del ecosistema exclusivos para `ADMIN` (`BK-01`). |
| **Asistente UP y Ecosistema (`AL-05`)** | `AssistantScreen.tsx`, `EcosystemScreen.tsx`, `assistantService.ts`, `ecosystemService.ts` | `GET /assistant/faqs`<br>`POST /assistant/escalate`<br>`GET /directory/links` | `faq_knowledge`<br>`redirection_links` | Motor determinista por reglas (sin IA generativa libre), `disclaimer` obligatorio, derivación a WhatsApp homologada (`{ whatsapp_url, phone, message }`) y seeds de las 5 categorías temáticas. |

---

## 2. Estado de Tareas de Auditoría (`BK-01..BK-07`, `AL-01..AL-05`, `FE-01..FE-07`)

### PARTE 1 · Backend (`BK-01` a `BK-07` + Aprobación Directa de Publicaciones y Comentarios)
- **[x] Regla de Negocio · Aprobación Directa de Publicaciones y Comentarios (`status = 'APPROVED'`):** Toda publicación (`createPost`, `updatePost`) y comentario (`createComment`) que supera `ContentFilterService` entra directamente con `status = 'APPROVED'`.
- **[x] BK-01 · CRUD Admin de FAQs (`/v1/admin/faqs`) y Enlaces del Ecosistema (`/v1/admin/directory/links`)**
- **[x] BK-02 · Trazabilidad por `user_account_id` en Reacciones y Bookmarks + `viewerSession` en Perfiles**
- **[x] BK-03 · Seguimiento Unidireccional (*Follow-Back*) y Prioridad de Relación Saliente (`OUTGOING`)**
- **[x] BK-04 · Prevención de robo/sobrescritura de cuentas por colisión de `email` o `username`**
- **[x] BK-05 · Invocar `GET /auth/perfil` (`getProfile`) en Login/Registro y preservar `username`**
- **[x] BK-06 · Bloqueo de escalada de privilegios a `ADMIN` en Registro, Perfil y Categoría Institucional**
- **[x] BK-07 · Trazabilidad al promover Sesión de Invitado a Cuenta Registrada e Integridad de Comentarios Huérfanos**

### PARTE 2 · Alineación de Datos y Contratos (`AL-01` a `AL-05`)
- **[x] AL-01 · Nombre completo (`first_names` + `last_names`), `local_role` y `username` en `AuthorBadgeDto`**
- **[x] AL-02 · Sincronización de `local_role` en `profileService.ts` / `publicProfileService.ts`, limpieza de `first_names` en `authService.register` y transformación `"" -> null` en `UpdateActorProfileDto`**
- **[x] AL-03 · Estado `liked_by_me` en Comentarios (`ApprovedCommentItemDto`) y estado `'APPROVED'` al crear Comentario**
- **[x] AL-04 · Contrato enriquecido de Notificaciones (`NotificationItemDto` y `findAggregatedNotifications` con `LIKE_ON_COMMENT` y `snippet`)**
- **[x] AL-05 · Homologación de `POST /v1/assistant/escalate` (`{ whatsapp_url, phone, message }`) y Seeds de las 5 Categorías de FAQs**

### PARTE 3 · Depuración y Alineación Visual en Frontend (`FE-01` a `FE-07`)
- **[x] FE-01 · Limpieza de contadores residuales en `profileService.ts` / `publicProfileService.ts`, soporte de `authorUsername` en `useContentRemoval.ts` y eliminación de archivos de pendientes obsoletos**
- **[x] FE-02 · Avisos visuales en línea compatibles con Web en `NewPostScreen.tsx`, `CommentsScreen.tsx` y `AssistantScreen.tsx`**
- **[x] FE-03 · Sello `"Fundación"` e ícono de comillas en tarjetas de texto de `ForumPostCard.tsx`**
- **[x] FE-04 · Foto de perfil real (`avatarUrl`) y navegación al perfil del autor en `CommentItem.tsx`**
- **[x] FE-05 · Cita (`snippet`), punto naranja de no leída, contador `"X nuevas"`, navegación al tocar y nota de 30 días en `NotificationsScreen.tsx`**
- **[x] FE-06 · Píldoras de vista previa, tarjetas de opción tipo radio en *"Quién puede seguirte"* y estilo del botón *"Cerrar sesión"* con ícono en `SettingsScreen.tsx`**
- **[x] FE-07 · Retroalimentación en línea en `NewPostScreen.tsx` y `AssistantScreen.tsx`**

---

## 3. Pendientes Priorizados (Siguiente Iteración)

### Completado en Revisión Post-Pull
- **[x] DOC-01 · Paridad OpenAPI (`openapi.yaml`) y `@ApiBearerAuth('DeviceSessionBearer')`**: Corregido el esquema Bearer en `AdminFaqsController` y `AdminDirectoryController`, y sincronizado `specs/001-asisconexion-mvp/contracts/openapi.yaml` con las rutas CRUD Admin (`BK-01`) y contratos `AL-01..AL-05`.
- **[x] CU-05 (Endurecimiento Reportes de Comentarios)**: Validación de duplicados por `reporter_device_id OR reporter_user_account_id`, inclusión de `target_content_preview` al crear/resolver reportes, cierre automático de reportes hermanos `OPEN` al retirar un comentario/post con `reject_target: true` y cobertura E2E completa alineada con `Frontend-Asisconnection`.
- **[x] PEND-02 · Conflictos de `email` y `username` en ambos sistemas (Render/Supabase ↔ `ASISCONEXION_DB`)**: Diferenciación explícita de errores `409 Conflict` por correo electrónico vs. nombre de usuario tanto en `ASISCONEXION_DB` como en el servicio central (Render/Supabase), evitando enmascarar errores reales de validación `400` y guiando al usuario a iniciar sesión cuando su correo ya existe en el ecosistema.

### Pendientes Abiertos por Resolver
- **[ ] PEND-03 · Promoción a rama `production`**:
  - Validar en staging/remoto y promover los cambios de `001-asisconexion-mvp` a `production` (crítico: mientras Render siga en `production`, no están activos `/v1/sessions/logout`, apodos familiares aleatorios, TTL 24h ni aprobación directa de posts/comentarios).

---

## 4. Deuda Técnica Detectada (Revisión Funcional y Consistencia de Sesión)

| ID | Prioridad | Capa | Hallazgo / Problema | Causa Raíz Confirmada | Acción Recomendada |
|---|---|---|---|---|---|
| **DT-01** | **Alta** | Frontend + Backend | En sesión anónima aparece el botón *"Eliminar"* en publicaciones de otras sesiones anónimas del mismo dispositivo (al confirmar falla en backend). | `useContentRemoval.ts` guarda los IDs en una clave global `asisconnection.guest-content.v1` y `hiddenContentKey('guest')` que **no se limpian en `signOut()`** ni se aíslan por `session_id`. | Limpiar claves de invitado al cerrar sesión y exponer `is_owner` / `can_delete` calculado en backend (`PublicPostItemDto` y `ApprovedCommentItemDto`) usando `user_account_id` / `device_id`. |
| **DT-02** | **Alta** | Frontend (`AuthProvider`) | Inconsistencia de datos y permisos al cambiar de cuenta o pasar entre sesión anónima y registrada. | `AuthProvider.tsx` **nunca ejecuta `queryClient.clear()`** en `signOut()`, `signIn()` ni `signInAnonymous()`, dejando caché de TanStack Query (`forum`, `profile`, `notifications`, `removal`) de la sesión anterior. | Limpiar caché de React Query en transiciones de sesión (`signOut`, `signIn`, `signInAnonymous`, `registerAccount`) y agregar `sessionId` a claves sensibles. |
| **DT-03** | **Alta** | Frontend (`authService` + `secureTokenStorage`) | Inconsistencia y tokens "pegados" al restaurar sesión anónima o tras expirar/revocar el JWT. | 1) `getProfile()` siempre llama primero a `/actors/me` (`403` para invitados) y si `/sessions/me` responde `401`, el `catch` interno traga el `401` y relanza el `403` (`forbidden`), impidiendo que `AuthProvider` borre el token (`sessionExpired`).<br>2) `secureTokenStorage(.web).ts` aplica expiración deslizante (`+24h` en cada lectura) mientras el JWT del backend tiene expiración fija (`exp = iat + 24h`), desalineando el vencimiento real. | Consultar directamente `/sessions/me` cuando `isAnonymous === true` (o propagar el `401` real de `/sessions/me`), y alinear la expiración del cliente al claim `exp` real del JWT (sin renovación deslizante artificial). |
| **DT-04** | **Media** | Backend + Despliegue | Apodos familiares aleatorios y rol `VISITANTE` no reflejados al probar contra entorno remoto + fallbacks heredados. | 1) Render aún apunta a `production` sin los últimos commits de `001-asisconexion-mvp` (`PEND-03`).<br>2) `current-session-response.dto.ts` mantiene `ANONYMOUS_FALLBACK_NAME = 'Invitado'` y `ANONYMOUS_FALLBACK_ROLE = 'BENEFICIARIO'`. | Promover `001-asisconexion-mvp` a `production` y actualizar los fallbacks de `toCurrentSessionDto` a `'Visitante'` y `'VISITANTE'`. |
| **DT-05** | **Media** | Frontend (`ProfileScreen` + `AuthProvider`) | La migración de actividad de invitado a cuenta registrada (`BK-07`) nunca se dispara desde la UI. | En `ProfileScreen.tsx`, tocar *"Iniciar sesión"* ejecuta `await signOut()` antes de navegar a `/login`, revocando/eliminando la sesión anónima antes de llamar `POST /auth/login` o `POST /auth/registro`. | Permitir navegar a `/login` o abrir `RegisterModal` conservando temporalmente el Bearer anónimo en `POST /auth/registro` / `POST /auth/login` para que `OptionalDeviceSessionGuard` migre posts/reacciones, y solo hacer `signOut` explícito al cerrar sesión. |
| **DT-06** | **Baja** | Frontend Web (`secureTokenStorage.web.ts`) | Desincronización de sesión entre múltiples pestañas en Web. | `localStorage` es compartido entre pestañas pero no existe listener del evento `window.addEventListener('storage', ...)` para sincronizar login/logout entre pestañas abiertas. | Suscribirse al evento `storage` en Web para reflejar cierres o cambios de sesión en pestañas simultáneas. |
