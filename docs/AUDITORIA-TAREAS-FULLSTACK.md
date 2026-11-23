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
