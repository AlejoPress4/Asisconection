# Auditoría y Plan de Tareas Full-Stack (`AsisConexión` Backend + Frontend) — Actualizado tras `CU-01..CU-05`, `T-41` y `BK-01..BK-07`

Documento maestro de seguimiento Full-Stack:
- **Backend (`Asisconnection`):** `CU-01..CU-05` (`404997b`), **implementación completa de `BK-01` a `BK-07`** y **aprobación directa de publicaciones (`status = 'APPROVED'`)**.
- **Frontend (`Frontend-Asisconnection`):** `afd743b` (*integrate CU-01 to CU-05*) y `47ed55a` (*T-41: add admin CRUD tabs for FAQs and ecosystem links*).

Leyenda de estado:
- `[x]` Completada y verificada
- `[~]` Parcialmente implementada (requiere ajuste en la otra capa)
- `[ ]` Pendiente por implementar

---

## RESUMEN DE LO YA IMPLEMENTADO (`CU-01..CU-05`, `T-41`, `BK-01..BK-07` y Aprobación Directa de Posts)

- **[x] Cambio de Regla de Negocio — Aprobación Directa de Publicaciones (`status = 'APPROVED'`):**
  - En `src/modules/social/services/posts.service.ts` (`createPost` y `updatePost`): toda publicación que supera el filtro automático (`ContentFilterService`) entra directamente con **`status = 'APPROVED'`** para cualquier usuario (si contiene enlaces externos, groserías, datos de menores o spam, el filtro automático la sigue rechazando con `status = 'REJECTED'` y `rejection_reason = 'AUTO_FILTER'`).
- **[x] CU-01 (Directorio de actores, Seguidores/Seguidos y Solicitudes):**
  - Backend: `GET /v1/actors?search=&role=`, `GET /v1/actors/:id/followers`, `GET /v1/actors/:id/following`, `DELETE /v1/connections/:id`, `GET /v1/connections?status=&direction=` con `peer_actor`, y `viewer_connection` en `GET /v1/actors/:id`.
  - Frontend: `FollowersScreen.tsx` con 4 pestañas (*Seguidores*, *Siguiendo*, *Solicitudes* con Aceptar/Rechazar y *Directorio*), `StatsCard.tsx` con clic en *Siguiendo*, y `OtherProfileScreen.tsx` con acciones según `viewer_connection`.
- **[x] CU-02 (Feed «Siguiendo», Búsqueda en Foro y Detalle `GET /v1/posts/:id`):**
  - Backend: `GET /v1/posts?feed=discover|following&search=...`, `GET /v1/posts/:id`, y campos `viewer_reactions` + `is_bookmarked` en `PublicPostItemDto`.
  - Frontend: Selector *Explorar / Siguiendo* y buscador en `ForumScreen.tsx`, y consulta directa a `GET /posts/:id` en `useActorPost.ts`.
- **[x] CU-03 (Edición `PATCH /v1/posts/:id`, Eliminación `DELETE /v1/posts/:id` y `DELETE /v1/comments/:id`, y «Mis envíos» `GET /v1/actors/me/submissions`):**
  - Backend y Frontend conectados (`EditPostModal.tsx`, pestaña *Mis envíos* en `ProfileScreen.tsx` y `deleteContent` en `removalService.ts`).
- **[x] CU-04 (Publicaciones Guardadas `POST /v1/posts/:postId/bookmarks` y `GET /v1/bookmarks`):**
  - Backend y Frontend conectados (botón bookmark en tarjetas y pestaña *Guardados* en `ProfileScreen.tsx`).
- **[x] CU-05 (Reportes Comunitarios `POST /v1/reports`, `GET /v1/admin/moderation/reports`, `PATCH /v1/admin/moderation/reports/:id/resolve`):**
  - Backend y Frontend conectados (`ReportContentModal.tsx` y pestaña *Reportes* en `AdminScreen.tsx`).
- **[x] T-41 + BK-01 (CRUD Admin de FAQs y Enlaces del Ecosistema Full-Stack):**
  - Frontend (`FaqManagementSection.tsx`, `EcosystemManagementSection.tsx`) y Backend (`AdminFaqsController` y `AdminDirectoryController`) implementados y conectados.

---

## PARTE 1 · Tareas en BACKEND (`Asisconnection` — `BK-01` a `BK-07` COMPLETADAS)

### 1.1. Nuevos Endpoints y Correcciones Derivadas de `CU-01..CU-05` y `T-41`

#### [x] **BK-01 (COMPLETADA) · Implementar en Backend el CRUD Admin de FAQs y Enlaces del Ecosistema**
- **Implementado en Backend:**
  - `src/modules/assistant/assistant.controller.ts` (`AdminFaqsController`), `assistant.service.ts`, `dto/faq-response.dto.ts`, `interfaces/i-faq-knowledge.repository.ts`, `repositories/faq-knowledge.repository.ts` y `assistant.module.ts` protegidos con `@UseGuards(DeviceSessionGuard, RolesGuard)` y `@Roles('ADMIN')`:
    - `POST /v1/admin/faqs` (`{ question, answer, category }`)
    - `PATCH /v1/admin/faqs/:id` (`{ question?, answer?, category? }`)
    - `DELETE /v1/admin/faqs/:id`
  - `src/modules/directory/directory.controller.ts` (`AdminDirectoryController`), `directory.service.ts`, `dto/redirection-link-response.dto.ts`, `interfaces/i-redirection-link.repository.ts`, `repositories/redirection-link.repository.ts` y `directory.module.ts` protegidos con `@UseGuards(DeviceSessionGuard, RolesGuard)` y `@Roles('ADMIN')`:
    - `POST /v1/admin/directory/links` (`{ project_name, url, description }`)
    - `PATCH /v1/admin/directory/links/:id` (`{ project_name?, url?, description?, is_active? }`)
    - `DELETE /v1/admin/directory/links/:id`

#### [x] **BK-02 (COMPLETADA) · Trazabilidad por `user_account_id` en Reacciones y Bookmarks (`post.repository.ts` y `reaction.repository.ts`)**
- **Implementado en Backend:**
  - En `findViewerReactionsByPostIds`, `findBookmarkedPostIds`, `toggleBookmark` (`src/modules/social/repositories/post.repository.ts`) y `toggle` / `toggleCommentReaction` (`src/modules/social/repositories/reaction.repository.ts`):
    - Cuando `userAccountId !== null`, se consulta y hace toggle por `(user_account_id = :userAccountId OR device_id = :deviceId)`, evitando pérdida de estado o duplicados al cambiar de sesión/dispositivo.
  - En `src/modules/social/controllers/posts.controller.ts` y `src/modules/social/services/posts.service.ts`:
    - Se agregó `@UseGuards(OptionalDeviceSessionGuard)` a `GET /v1/actors/:id/posts` y se propaga `viewerSession` a `this.listApproved(query, userAccountId, viewerSession)` tanto en `listMyApprovedPosts` como en `listActorApprovedPosts`.

#### [x] **BK-03 (COMPLETADA EN BACKEND) · Seguimiento Unidireccional vs. Bidireccional (`actor.repository.ts`)**
- **Implementado en Backend:**
  - En `src/modules/auth-session/repositories/actor.repository.ts` (`createConnection`): se valida duplicado únicamente en la dirección saliente `(ac.requester_actor_id = :requesterActorId AND ac.receiver_actor_id = :receiverActorId)` (o bloqueo activo `status = 'BLOCKED'`), permitiendo que B siga de vuelta a A (*follow back*).
  - En `src/modules/auth-session/repositories/actor.repository.ts` (`findConnectionBetweenActors`): se prioriza la conexión saliente (`requester_actor_id = viewerActorId AND receiver_actor_id = targetActorId`) sobre la entrante.
  - *Nota para Frontend:* falta ajustar `toConnectionStatus` en `src/modules/profile/services/publicProfileService.ts` cuando `direction === 'INCOMING'`.

---

### 1.2. Seguridad de Identidad, Prevención de Robo de Cuentas y Roles

#### [x] **BK-04 (COMPLETADA) · Prevención de robo/sobrescritura de cuentas por colisión de `email` o `username` (`local-user.repository.ts` y `auth-session.service.ts`)**
- **Implementado en Backend:**
  - En `src/modules/auth-session/auth-session.service.ts` (`register`) y `src/modules/auth-session/repositories/local-user.repository.ts` (`findAccountWithManager`):
    - Se marca `isNewRegistration: true` en registro para impedir cualquier `merge` sobre cuentas existentes (`409 ConflictException`).
    - Se buscan coincidencias independientes por `externalUserId`, `LOWER(username)` y `LOWER(email)` y se lanza `409 ConflictException` si coinciden cuentas distintas o si `externalUserId` difiere del ya vinculado.

#### [x] **BK-05 (COMPLETADA) · Invocar `GET /auth/perfil` (`getProfile`) en Login/Registro y preservar `username` (`render-auth.http-adapter.ts` y `local-user.repository.ts`)**
- **Implementado en Backend:**
  - En `src/modules/auth-session/adapters/render-auth.http-adapter.ts`: cuando la respuesta de `/auth/login` o `/auth/registro` incluye `token` pero no trae `username` y `rol` explícitos, se invoca `enrichWithProfile` (`GET /auth/perfil`).
  - En `src/modules/auth-session/repositories/local-user.repository.ts`: si `input.username` es un fallback igual al correo electrónico y la cuenta ya existe, se preserva `existingUser.username`.

#### [x] **BK-06 (COMPLETADA) · Bloqueo de escalada de privilegios a `ADMIN` en Registro, Perfil y Categoría Institucional**
- **Implementado en Backend:**
  - Se retiró `'ADMIN'` de `ALLOWED_REGISTRATION_ROLES` en `src/modules/auth-session/dto/register-user.dto.ts`.
  - Se restringió `primary_role` a `['ACUDIENTE', 'VOLUNTARIO', 'INVERSOR', 'BENEFICIARIO']` en `UpdateActorProfileDto` (`src/modules/auth-session/dto/actor-profile.dto.ts`) y se bloqueó `ADMIN`/`MODERATOR` en `ActorsService.updateMyProfile` (`src/modules/auth-session/actors.service.ts`).
  - En `src/modules/social/services/posts.service.ts` (`createPost`): se verifica mediante `findCategoryById` que solo usuarios con rol `ADMIN` o `MODERATOR` puedan publicar en categorías institucionales (`Noticias` / `Avisos` / `Institucional`), lanzando `403 ForbiddenException` en caso contrario.

#### [x] **BK-07 (COMPLETADA) · Trazabilidad al promover Sesión de Invitado a Cuenta Registrada e Integridad de Comentarios Huérfanos**
- **Implementado en Backend:**
  - En `src/modules/auth-session/repositories/local-user.repository.ts` (`upsertUserAndSession`): al promover una sesión anónima (`existingAnonymousSessionId`) a cuenta registrada, se actualiza `user_account_id = savedUser.id` en `posts`, `comments`, `reactions`, `comment_reactions` y `post_bookmarks` asociados a ese `device_id`.
  - En `src/modules/social/repositories/comment.repository.ts`, `src/modules/social/repositories/post.repository.ts` y `src/modules/moderation/repositories/moderation.repository.ts`: al eliminar o rechazar un comentario padre se eliminan/rechazan en cascada sus respuestas (`parent_id`), y las consultas de comentarios aprobados filtran respuestas cuyo padre no esté en `APPROVED`.

---

## PARTE 2 · Alineación de Datos y Contratos Pendientes (Backend ↔ Frontend)

### [ ] **AL-01 · Nombre completo (`first_names` + `last_names`), `local_role` y `username` en `AuthorBadgeDto`**
- **Estado actual:** En `posts.service.ts` (líneas 83-91), `buildAuthorBadge` sigue devolviendo `display_name: source.username` y `role_label: source.rol`.
  - Aunque el usuario edite sus nombres y apellidos en su perfil, en el Foro, Comentarios y Moderación sigue saliendo su `username`.
  - Aunque un usuario tenga `local_role = 'MODERATOR'`, en sus publicaciones y comentarios sigue saliendo su rol base (`ACUDIENTE`) y no recibe el sello `"Fundación"`.
  - `moderation.repository.ts` (`findPending`, `listModerators`, `setLocalRole`) sigue sin hacer `LEFT JOIN actors a`.
- **Qué implementar (Back + Front):**
  - En `post.repository.ts`, `comment.repository.ts` y `moderation.repository.ts`: seleccionar `a.first_names`, `a.last_names`, `a.primary_role` y `ua.local_role`.
  - En `buildAuthorBadge`: construir `display_name` con `first_names + ' ' + last_names` (fallback a `username`), incluir `username` en `AuthorBadgeDto`, y priorizar `ADMIN` → `MODERATOR` (`local_role`) en `role_label`.

### [ ] **AL-02 · Sincronización de `local_role` en `profileService.ts` / `publicProfileService.ts` y limpieza de `first_names` en `authService.register`**
- **Estado actual:**
  1. `profileService.ts` (línea 249) y `publicProfileService.ts` (línea 192) siguen mapeando `roles: toRoleCodes(actor.primary_role)` ignorando `actor.local_role`. Por eso un `MODERATOR` no ve el botón para abrir el Panel de Moderación en `ProfileScreen.tsx`.
  2. `authService.ts` (línea 170) sigue enviando `PATCH /actors/me` con `first_names: user.username` tras registrarse, contaminando el campo "Nombres" con el `username`.
  3. `UpdateActorProfileDto` en Backend no transforma `""` a `null` cuando el usuario quiere vaciar `city`, `birth_date`, `short_bio` o `last_names`.

### [ ] **AL-03 · Estado `liked_by_me` en Comentarios (`ApprovedCommentItemDto`) y estado `'APPROVED'` al crear Comentario**
- **Estado actual:**
  1. `GET /v1/posts` ya devuelve `viewer_reactions`, pero `GET /v1/posts/:postId/comments` **no tiene `@UseGuards(OptionalDeviceSessionGuard)` ni devuelve si el usuario actual ya dio like a cada comentario (`liked_by_me` / `viewer_has_liked`)**.
  2. En `src/modules/comments/domain/models/Comment.ts`, `CommentSubmissionStatus` sigue siendo `'PENDING' | 'REJECTED'` (falta `'APPROVED'`), y `CommentsScreen.tsx` sigue mostrando la alerta *"Comentario enviado a revisión"* incluso cuando comenta un `ADMIN` o `MODERATOR` (cuyo comentario se aprueba de inmediato).

### [ ] **AL-04 · Contrato enriquecido de Notificaciones (`NotificationItemDto` y `findAggregatedNotifications`)**
- **Estado actual:** `findAggregatedNotifications` (`post.repository.ts` líneas 715-819) no cambió en `404997b`:
  - Sigue faltando el evento **`LIKE_ON_COMMENT`** (tabla `comment_reactions`).
  - `NEW_FOLLOWER` no distingue si la conexión está en `status = 'PENDING'` (*"te envió una solicitud para seguirte"*) vs `'ACCEPTED'` (*"comenzó a seguirte"*).
  - `NotificationItemDto` solo devuelve `{ id, type, title, body, is_read, created_at }` sin `actor_id`, `actor_name`, `actor_avatar_url`, `post_id`, `comment_id`, `connection_id`, `category_name` ni `snippet`.

### [ ] **AL-05 · Homologación de `POST /v1/assistant/escalate` y Seeds de FAQs / Ecosistema**
- **Estado actual:**
  - `EscalateResponseDto` en Backend devuelve `{ whatsapp_url, support_message }` mientras `assistantService.ts` en Frontend espera `{ whatsapp_url, phone, message }`.
  - `faq-knowledge.seed.ts` sigue teniendo solo 3 categorías (`Inscripciones`, `Programas`, `Voluntariado`) en lugar de los 5 temas de `04-Asistente.html`, y `redirection-links.seed.ts` sigue con las URLs placeholder `*.fundacionasisco.org`.

---

## PARTE 3 · Tareas Pendientes en FRONTEND (`Frontend-Asisconnection` — Limpieza y Brechas Visuales con Mockups HTML)

### 3.1. Limpieza de Parches Residuales y Compatibilidad Web

#### [ ] **FE-01 · Retirar parches residuales `authorRemovalMarks.ts` y `localUnfollowState.ts`, ajustar `toConnectionStatus` (`INCOMING`) y corregir `isOwnContent`**
- Ahora que el Backend ya tiene `DELETE /v1/posts/:id`, `DELETE /v1/comments/:id` y `DELETE /v1/connections/:id`, retirar la resta artificial de contadores en `profileService.ts` / `publicProfileService.ts` (`countPostsRemovedByAuthor`, `countUnfollowedActors`), ajustar `toConnectionStatus('ACCEPTED', 'INCOMING')` a `'notFollowing'` en `publicProfileService.ts`, y corregir `isOwnContent` en `useContentRemoval.ts` para comparar también por `actor_id` / `username`.

#### [ ] **FE-02 · Reemplazar `Alert.alert` por aviso visual compatible con Web (`T-28`)**
- En `NewPostScreen.tsx`, `CommentsScreen.tsx` y `AssistantScreen.tsx`, `Alert.alert` es ignorado en navegador Web. Reemplazarlo por feedback visual o diálogo multiplataforma (y actualizar el mensaje de creación/edición de publicación ya que ahora las publicaciones limpias entran directamente con `status = 'APPROVED'`).

---

### 3.2. Brechas Visuales respecto a los Mockups HTML (`docs/diseno/html/`)

#### [ ] **FE-03 · Foro (`ForumScreen.tsx` y `ForumPostCard.tsx` vs `02-Foro.html`)**
- Mostrar el **punto naranja de notificaciones sin leer** sobre el botón de la campana del header cuando existan notificaciones con `isRead === false`.
- Agregar el **ícono de comillas** en las tarjetas de solo texto (`post.media === null`) y el sello `"Fundación"` cuando el autor sea `ADMIN` o `MODERATOR`.

#### [ ] **FE-04 · Hoja de Comentarios (`CommentsScreen.tsx` y `CommentItem.tsx` vs `06-Comentarios.html`)**
- Mostrar en la cabecera de `CommentsScreen.tsx` el **resumen de la publicación original** (avatar, nombre, tiempo, chip de categoría y texto) usando `GET /v1/posts/:postId` antes del contador `"X comentarios"`.
- Renderizar la **foto de perfil real (`avatar_url`)** en `CommentItem.tsx` y en el compositor inferior (en lugar de mostrar solo iniciales).
- Permitir tocar el avatar o nombre del autor de un comentario registrado para ir a su perfil (`/users/[userId]`).

#### [ ] **FE-05 · Pantalla de Notificaciones (`NotificationsScreen.tsx` vs `07-Notificaciones.html`)**
- Rediseñar las filas de `NotificationsScreen.tsx` según `07-Notificaciones.html`:
  - Avatar del actor + **mini-badge circular con ícono del tipo de evento** (corazón rojo para *like*, burbuja verde para *comentario/respuesta*, admiración naranja para *aviso de fundación*, usuario para *seguidor*).
  - Nombre del autor en negrita + acción.
  - **Recuadro de cita (`snippet`)** con borde izquierdo del color de la categoría.
  - Tiempo relativo (`hace 10 min`), **punto naranja** a la derecha si no está leída, contador `"X nuevas"` junto a `"Hoy"`, nota al pie *"Solo mostramos las notificaciones de los últimos 30 días."* y navegación al tocar cada notificación.

#### [ ] **FE-06 · Ajustes del Perfil (`SettingsScreen.tsx` vs `09-Ajustes.html`)**
- En **"ASÍ TE VEN LOS DEMÁS"**: mostrar la tarjeta de vista previa con `<Avatar>`, nombre completo, `<RoleBadge>` y píldoras dinámicas (`Nombre y rol`, `Publicaciones`, `Correo`, `Fecha de nacimiento`, `Ciudad`).
- En **"Información que muestras"**: mostrar debajo de cada campo (`Correo`, `Fecha de nacimiento`, `Ciudad`) el valor actual guardado en el perfil del usuario.
- En **"Quién puede seguirte"**: reemplazar el `ToggleRow` (*"Visible para la comunidad / Solo yo"*) por las **2 tarjetas de opción tipo radio** del mockup (*"Cualquier miembro"* y *"Con mi aprobación"*).
- Ajustar el estilo del botón **"Cerrar sesión"** al mockup (`09-Ajustes.html`: fondo blanco, borde `#E3C5C0`, texto e ícono en `#8A2F2F`).

#### [ ] **FE-07 · Nueva Publicación y Asistente en 2 Niveles (`NewPostScreen.tsx` y `AssistantScreen.tsx`)**
- En `NewPostScreen.tsx` (`10-Nueva-publicacion.html`): mostrar el `<Avatar>` con la foto real del usuario y su nombre completo en lugar de iniciales fijas del `username`.
- En `AssistantScreen.tsx` (`04-Asistente.html` y `04b-Asistente-respuesta.html`): implementar la selección en 2 pasos (**Categoría → Pregunta de esa categoría**), auto-scroll al agregar respuesta y opciones de seguimiento (*"¿Te sirvió esta respuesta?"* / *"Hablar con una persona"*).
