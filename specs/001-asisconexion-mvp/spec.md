# Feature Specification: AsisConexión MVP (v2)

**Feature Branch**: `001-asisconexion-mvp`

**Created**: 2026-10-25 | **Updated**: 2026-10-27

**Status**: Approved (v2)

**Input**: User description: "Especificación del Sistema (Specify v2): AsisConexión MVP — Flujo híbrido de identidad mediante el servicio central HTTP en Render/Supabase (`POST /auth/login`, `POST /auth/registro`, `GET /auth/perfil`) con persistencia única en PostgreSQL (`ASISCONEXION_DB`), perfiles `Actor` y conexiones `ActorConnection` exclusivos para usuarios registrados, foros temáticos públicos con soporte de múltiples URLs multimedia (`PostMedia`), comentarios anidados en hilos (`parent_id`), reacciones a publicaciones y comentarios, moderación en dos capas (filtro automático por reglas `ContentFilterService` + revisión humana obligatoria `RN-02` por `ADMIN` o `MODERATOR` global), directorio de módulos satélites y asistente de orientación FAQ con escalamiento a WhatsApp (descartando RAG en Fase 2)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identidad Centralizada (Render/Supabase) y Acceso por Dispositivo con Consentimiento Legal (Priority: P1)

Como acudiente, voluntario, donante, estudiante, beneficiario o visitante de la Fundación Asisco, necesito ingresar a AsisConexión ya sea registrando una cuenta nueva a través del servicio central de identidad, iniciando sesión con mi cuenta existente en el ecosistema de la Fundación (Render/Supabase) o iniciando una sesión rápida anónima en mi dispositivo, aceptando expresamente el tratamiento de datos personales para poder interactuar de forma segura.

**Why this priority**: Es la puerta de entrada obligatoria de todo el ecosistema; permite unificar el login con el servicio externo en Render/Supabase sin exceder su límite de peticiones (*rate limit* de 20 cada 15 min) al emitir un `device_token` local propio tras validar la identidad, y asegura la trazabilidad legal del consentimiento.

**Independent Test**: Se puede probar registrando un usuario nuevo en `/v1/auth/registro`, iniciando sesión en `/v1/auth/login` con credenciales válidas del servicio externo y creando una sesión anónima en `/v1/sessions/anonymous`, comprobando que se exige `accept_consent = true`, se crea `UserAccount` + `Actor` (solo para usuarios registrados) + `DeviceSession` en `ASISCONEXION_DB`, y se entrega `device_token` sin exponer jamás `clave` ni el token opaco externo.

**Acceptance Scenarios**:

1. **Given** una persona usuaria nueva que acepta el consentimiento de datos personales, **When** envía su solicitud en `POST /v1/auth/registro` con `username`, `email`, `clave`, `rol` y `accept_consent = true`, **Then** el sistema registra al usuario en el servicio central (`POST /auth/registro`), autentica automáticamente (`POST /auth/login`), persiste en `ASISCONEXION_DB` su `UserAccount` (`external_user_id` numérico, `external_roles[]`), su perfil `Actor` 1:1 y su `DeviceSession` con `consent_accepted_at`, y retorna los datos públicos junto con `device_token`. Si el usuario ya existe en el servicio externo, responde `409 Conflict` indicando que puede iniciar sesión con su cuenta existente.
2. **Given** una persona ya registrada en el servicio central (Render/Supabase), **When** envía `email` y `clave` con `accept_consent = true` a `POST /v1/auth/login`, **Then** el sistema valida sus credenciales contra `POST /auth/login` del servicio externo, sincroniza en `ASISCONEXION_DB` su `UserAccount` (incluyendo `external_user_id` y arreglo `external_roles`, otorgando privilegios de `ADMIN` si `'ADMIN'` está en `external_roles`), asegura la existencia de su perfil `Actor` 1:1, registra su `DeviceSession` y emite el `device_token` local.
3. **Given** una persona visitante que desea explorar y participar sin crear cuenta, **When** inicia sesión rápida en `POST /v1/sessions/anonymous` enviando opcionalmente `nickname` y `role_tag` junto con `accept_consent = true`, **Then** el sistema registra únicamente la `DeviceSession` con `consent_accepted_at` (sin crear `UserAccount` ni perfil `Actor`) y retorna `device_token` y `session_id`.
4. **Given** cualquier solicitud de registro, login o sesión anónima donde `accept_consent` sea falso o esté ausente, **When** se procesa la solicitud, **Then** el sistema rechaza la operación con `400 Bad Request` (RFC 7807) y no crea sesión ni llama al servicio externo.

---

### User Story 2 - Perfiles (`Actor`) y Red de Conexiones para Usuarios Registrados (Priority: P1)

Como usuario registrado en AsisConexión, necesito consultar y actualizar mi perfil comunitario (`Actor`) y enviar, aceptar o bloquear solicitudes de conexión (`ActorConnection`) con otros miembros registrados para fortalecer la red de apoyo de la Fundación.

**Why this priority**: Materializa el diseño social extendido de la comunidad para usuarios registrados, diferenciándolos claramente de las sesiones anónimas (que no tienen perfil ni conexiones).

**Independent Test**: Se puede probar autenticando dos usuarios registrados, editando sus datos de `Actor` (`first_names`, `last_names`, `avatar_url`, `short_bio`), enviando una solicitud de conexión de A hacia B, aceptándola o bloqueándola desde B y listando las conexiones activas, además de verificar que una sesión anónima recibe `403 Forbidden` al intentar usar estos endpoints.

**Acceptance Scenarios**:

1. **Given** un usuario registrado con sesión activa, **When** consulta `GET /v1/actors/me` o actualiza sus datos en `PATCH /v1/actors/me` (`first_names`, `last_names`, `avatar_url`, `short_bio`, `primary_role`), **Then** el sistema devuelve o actualiza su perfil `Actor` asociado 1:1 a su `UserAccount`.
2. **Given** un usuario registrado con sesión activa, **When** envía una solicitud de conexión a otro `Actor` en `POST /v1/connections` (`receiver_actor_id`), **Then** se crea un registro `ActorConnection` con `status = 'PENDING'` y `requested_at`.
3. **Given** un usuario registrado receptor de una solicitud o partícipe de una conexión, **When** actualiza el estado en `PATCH /v1/connections/:id` a `'ACCEPTED'` o `'BLOCKED'`, **Then** el sistema actualiza el estado (registrando `accepted_at` cuando es `'ACCEPTED'`) y permite consultar las conexiones en `GET /v1/connections`.
4. **Given** una sesión anónima (`user_account_id = null`), **When** intenta acceder a `/v1/actors/me` o `/v1/connections*`, **Then** el sistema deniega el acceso con `403 Forbidden` porque los visitantes anónimos no poseen perfil `Actor`.

---

### User Story 3 - Participación en Foros Públicos, Multimedia por URLs, Hilos de Comentarios y Reacciones (Priority: P1)

Como miembro de la comunidad (registrado o anónimo), necesito explorar los foros temáticos públicos, leer publicaciones aprobadas junto con sus URLs multimedia y comentarios anidados en hilos, publicar mensajes o respuestas y reaccionar libremente tanto a publicaciones como a comentarios.

**Why this priority**: Constituye el núcleo de interacción comunitaria, incorporando soporte de múltiples URLs de imágenes por publicación, hilos de conversación (`parent_id`) y reacciones en comentarios, con protección de cuota diaria para anónimos.

**Independent Test**: Se puede probar consultando categorías (con `main_topic` y `cover_image_url`), creando una publicación con arreglo `media_urls`, creando un comentario raíz y una respuesta hija (`parent_id`), y alternando reacciones (`LIKE`, `SUPPORT`, `THANKS`) en publicaciones y comentarios.

**Acceptance Scenarios**:

1. **Given** cualquier persona usuaria, **When** consulta `GET /v1/categories` y `GET /v1/posts?categoryId={uuid}&page={n}&limit={m}`, **Then** recibe los foros públicos (incluyendo `main_topic` y `cover_image_url`, sin existir foros privados) y las publicaciones con `status = 'APPROVED'`, sus URLs en `media_urls` (`PostMedia`), conteo de reacciones y comentarios aprobados.
2. **Given** una persona con `DeviceSession` válida (registrada o anónimo dentro de su límite diario de 3 posts y 10 comentarios), **When** crea una publicación en `POST /v1/posts` (con `media_urls?: string[]` opcionales) o un comentario/respuesta en `POST /v1/posts/:postId/comments` (con `parent_id?: uuid` opcional), **Then** el contenido pasa primero por el filtro automático (`ContentFilterService`): si infringe alguna regla queda en `status = 'REJECTED'` con `rejection_reason = 'AUTO_FILTER'`; si pasa el filtro, se almacena en `status = 'PENDING'` a la espera de moderación humana.
3. **Given** una sesión anónima que supera el límite diario configurado (por defecto 3 publicaciones o 10 comentarios por dispositivo en 24 horas), **When** intenta publicar o comentar nuevamente, **Then** el sistema rechaza la solicitud con `429 Too Many Requests` (RFC 7807), mientras que puede seguir reaccionando sin restricción alguna.
4. **Given** una persona con `DeviceSession` válida (registrada o anónima), **When** envía una reacción (`LIKE`, `SUPPORT` o `THANKS`) a `POST /v1/posts/:postId/reactions` o a `POST /v1/comments/:id/reactions`, **Then** el sistema registra o elimina la reacción sin límite de cuota sobre contenidos con estado `APPROVED`.

---

### User Story 4 - Moderación en Dos Capas (Filtro Automático + Humana) y Gestión de Moderadores Globales (Priority: P1)

Como administrador (`ADMIN`) o moderador global (`MODERATOR`) de AsisConexión, necesito revisar la cola de publicaciones y comentarios en estado `PENDING` para aprobarlos o rechazarlos (`rejection_reason = 'HUMAN'`), y como `ADMIN` necesito asignar o revocar el rol `MODERATOR` a usuarios registrados de confianza.

**Why this priority**: Garantiza la protección integral de menores y familias (RN-02) combinando filtrado automático inmediato con supervisión humana escalable mediante moderadores globales designados por los administradores.

**Independent Test**: Se puede probar verificando que un post con groserías/enlaces externos/datos de menores/spam nace directamente en `REJECTED` (`AUTO_FILTER`), que un `ADMIN` puede promover a un usuario registrado a `MODERATOR` en `PUT /v1/admin/moderators/:userAccountId`, que dicho `MODERATOR` puede aprobar/rechazar contenido en `/v1/admin/moderation/*`, y que el `MODERATOR` recibe `403 Forbidden` si intenta gestionar otros moderadores.

**Acceptance Scenarios**:

1. **Given** una publicación o comentario nuevo cuyo texto contiene groserías, enlaces externos (`http://`, `https://`, `www.`), datos sensibles de menores (documentos, teléfonos o combinaciones de menor + edad/datos) o spam aleatorio, **When** se envía al backend, **Then** `ContentFilterService` lo detecta mediante sus reglas `IContentRule` y lo persiste con `status = 'REJECTED'` y `rejection_reason = 'AUTO_FILTER'`, sin llegar al muro público ni a la cola `PENDING`.
2. **Given** un usuario autenticado con rol `ADMIN` (proveniente de `external_roles` en Render/Supabase), **When** invoca `PUT /v1/admin/moderators/:userAccountId` o `DELETE /v1/admin/moderators/:userAccountId` o consulta `GET /v1/admin/moderators`, **Then** asigna o revoca `local_role = 'MODERATOR'` sobre esa cuenta registrada y lista los moderadores globales activos.
3. **Given** un usuario autenticado que posee `'ADMIN'` en `external_roles` o `local_role = 'MODERATOR'`, **When** consulta `GET /v1/admin/moderation/pending` o actualiza estados en `PATCH /v1/admin/moderation/posts/:id/status` y `PATCH /v1/admin/moderation/comments/:id/status`, **Then** puede aprobar (`APPROVED`) o rechazar (`REJECTED` con `rejection_reason = 'HUMAN'`) el contenido.
4. **Given** un usuario con `local_role = 'MODERATOR'` (sin ser `ADMIN`), **When** intenta acceder a `/v1/admin/moderators*`, **Then** recibe `403 Forbidden`.

---

### User Story 5 - Directorio de Redireccionamiento a Módulos Satélites (Priority: P2)

Como persona usuaria de la Fundación Asisco, necesito consultar el directorio oficial de programas y plataformas satélites (como SUMA 21, AULA UP y SAGA-UP) y abrirlos directamente de forma nativa fuera de AsisConexión.

**Why this priority**: Mantiene a AsisConexión como punto de acceso unificado hacia el portafolio digital de la Fundación.

**Independent Test**: Consultar `GET /v1/directory/links` y verificar que entrega únicamente enlaces con `is_active = true` paginados.

**Acceptance Scenarios**:

1. **Given** enlaces registrados en `RedirectionLink`, **When** una persona consulta `GET /v1/directory/links`, **Then** recibe únicamente los enlaces con `is_active = true` paginados y con URLs externas limpias.

---

### User Story 6 - Orientación por Preguntas Frecuentes y Escalamiento Humano vía WhatsApp (Priority: P2)

Como miembro de la comunidad que busca orientación rápida, necesito consultar preguntas frecuentes con aviso transparente de asistencia automatizada y contar con un enlace directo para escalar mi caso a atención humana por WhatsApp.

**Why this priority**: Resuelve dudas frecuentes al instante manteniendo costos operativos cero (sin RAG costoso en el corto plazo) y conservando `IAssistantEngineProvider` abierto para el futuro.

**Independent Test**: Consultar `GET /v1/assistant/faqs` y `POST /v1/assistant/escalate` verificando el *disclaimer* y la URL de WhatsApp.

**Acceptance Scenarios**:

1. **Given** entradas en `FaqKnowledge`, **When** la persona consulta `GET /v1/assistant/faqs`, **Then** recibe las preguntas frecuentes paginadas junto con el *disclaimer* informativo a través de `FaqRuleEngineProvider` (`IAssistantEngineProvider`).
2. **Given** una persona que requiere atención personalizada, **When** envía `POST /v1/assistant/escalate`, **Then** recibe el enlace hacia el canal oficial de WhatsApp de la Fundación.

---

### Edge Cases

- **Límite de tasa (*rate limit* 20 req / 15 min) o caída del servicio externo en Render**: El backend solo contacta a Render durante `/v1/auth/login` y `/v1/auth/registro`. Si Render responde `429 Too Many Requests`, timeout o `5xx`, el adaptador `IExternalAuthAdapter` traduce el fallo a `502 BadGatewayException` (RFC 7807) y **nunca** emite un `device_token` sin haber persistido `UserAccount` en `ASISCONEXION_DB`.
- **Usuario ya existente en Supabase/Render al intentar registrarse**: Si el usuario intenta `/v1/auth/registro` pero ya existe en el servicio externo, se devuelve `409 Conflict` para que inicie sesión directamente en `/v1/auth/login` con su cuenta existente.
- **Contenido rechazado por el filtro automático (`AUTO_FILTER`)**: Se almacena en base de datos con `status = 'REJECTED'` y `rejection_reason = 'AUTO_FILTER'` para trazabilidad y auditoría, devolviendo al cliente una respuesta clara del estado sin exponerlo jamás en el muro público.
- **Comentarios en hilo (`parent_id`)**: Un comentario solo puede responder a otro comentario que pertenezca al mismo `post_id` y que exista en `ASISCONEXION_DB`. Solo los comentarios con `status = 'APPROVED'` se exponen públicamente.
- **Almacenamiento multimedia**: El sistema valida que `media_urls`, `avatar_url` y `cover_image_url` sean exclusivamente URLs válidas (`http`/`https`), sin recibir binarios pesados.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer `POST /v1/auth/registro` recibiendo `{ username, email, clave, rol, accept_consent }`, invocar `IExternalAuthAdapter` (`POST /auth/registro` y login subsecuente en Render), persistir en `ASISCONEXION_DB` el `UserAccount` (`external_user_id` numérico, `external_roles[]`), su perfil `Actor` 1:1 y la `DeviceSession` con `consent_accepted_at`, y devolver `{ user, actor, device_token }` sin exponer `clave` ni el token opaco externo.
- **FR-002**: El sistema DEBE exponer `POST /v1/auth/login` recibiendo `{ email, clave, accept_consent }`, autenticar contra `POST /auth/login` del servicio externo en Render (`{ token, expiraEn, usuario: { usuarioId, username, email, fechaCreacion, roles } }`), sincronizar `UserAccount` (`external_user_id = usuarioId`, `external_roles = roles`, `last_synced_at`), asegurar la existencia de su `Actor` 1:1 y emitir el `device_token` local.
- **FR-003**: El sistema DEBE exponer `POST /v1/sessions/anonymous` recibiendo `{ nickname?, role_tag?, accept_consent }`, exigiendo `accept_consent = true` y creando únicamente `DeviceSession` (sin `UserAccount` ni `Actor`).
- **FR-004**: El sistema DEBE exponer `GET /v1/actors/me`, `PATCH /v1/actors/me` y `GET /v1/actors/:id` exclusivamente para usuarios registrados, así como `POST /v1/connections`, `PATCH /v1/connections/:id` (`ACCEPTED` | `BLOCKED`) y `GET /v1/connections` para gestionar conexiones entre perfiles `Actor`.
- **FR-005**: El sistema DEBE exponer `GET /v1/categories` (incluyendo `main_topic` y `cover_image_url`; todos los foros son públicos) y `GET /v1/posts?categoryId={uuid}&page={n}&limit={m}` con paginación obligatoria, retornando exclusivamente publicaciones con `status = 'APPROVED'`, sus URLs en `media_urls` (`PostMedia`), autor, conteo de reacciones y comentarios aprobados.
- **FR-006**: El sistema DEBE exponer `POST /v1/posts` (con `media_urls?: string[]`) y `POST /v1/posts/:postId/comments` (con `parent_id?: uuid` opcional para hilos), aplicando límites diarios configurables a sesiones anónimas (3 posts y 10 comentarios por día por dispositivo) y ejecutando siempre `ContentFilterService`: si una regla `IContentRule` detecta groserías, enlaces externos, datos de menores o spam, el registro nace con `status = 'REJECTED'` y `rejection_reason = 'AUTO_FILTER'`; en caso contrario nace con `status = 'PENDING'` y `rejection_reason = null`.
- **FR-007**: El sistema DEBE exponer `POST /v1/posts/:postId/reactions` y `POST /v1/comments/:id/reactions` para alternar reacciones (`LIKE`, `SUPPORT`, `THANKS`) sobre publicaciones y comentarios aprobados, sin restricción de cuota para sesiones anónimas ni registradas.
- **FR-008**: El sistema DEBE otorgar privilegios de `ADMIN` a todo usuario cuyos `external_roles` incluyan `'ADMIN'`, y exponer `GET /v1/admin/moderators`, `PUT /v1/admin/moderators/:userAccountId` y `DELETE /v1/admin/moderators/:userAccountId` exclusivamente para `ADMIN` con el fin de asignar o revocar `local_role = 'MODERATOR'`.
- **FR-009**: El sistema DEBE permitir el acceso a `GET /v1/admin/moderation/pending`, `PATCH /v1/admin/moderation/posts/:id/status` y `PATCH /v1/admin/moderation/comments/:id/status` tanto a usuarios `ADMIN` como a usuarios con `local_role = 'MODERATOR'`, registrando `rejection_reason = 'HUMAN'` cuando un moderador o administrador rechace un contenido.
- **FR-010**: El sistema DEBE mantener `GET /v1/directory/links`, `GET /v1/assistant/faqs` (vía `FaqRuleEngineProvider` e `IAssistantEngineProvider`, sin RAG en Fase 2) y `POST /v1/assistant/escalate`, y devolver todos los errores bajo el estándar RFC 7807.

### Constitutional & Compliance Constraints *(mandatory where applicable)*

- **CC-001 (Segregación de Contratos y Confidencialidad — ISP)**: Los contratos públicos DEBEN excluir `clave` y el token opaco devuelto por Render.
- **CC-002 (Persistencia Única + Servicio HTTP — §II)**: Queda eliminada toda conexión directa a `FOUNDATION_GLOBAL_DB`; toda persistencia reside en `ASISCONEXION_DB` con identificadores UUID.
- **CC-003 (Moderación en Dos Capas — Filtro Automático + RN-02)**: Todo `Post` y `Comment` pasa por `ContentFilterService` (`IContentRule`) y, si no es rechazado automáticamente (`AUTO_FILTER`), nace en `PENDING` hasta aprobación humana (`ADMIN` o `MODERATOR`).
- **CC-004 (Cumplimiento Ley 1581 de 2012 y Ley 1098 de 2006 — Colombia)**: Toda `DeviceSession` y publicación multimedia por URL exige `consent_accepted_at` válido, y el filtro automático bloquea datos sensibles de menores.
- **CC-005 (Asistente Abierto sin RAG costoso — OCP)**: Se conserva `IAssistantEngineProvider` con `FaqRuleEngineProvider` y se retira el alcance de RAG (`pgvector` + LLM) por criterios presupuestales.

### Key Entities *(include if feature involves data)*

- **`UserAccount` (`user_accounts`)**: Cuenta local sincronizada con el servicio central de Render/Supabase; contiene `id` (UUID), `external_user_id` (`INT UNIQUE`, mapeado desde `usuarioId`), `username` (`UNIQUE`), `email` (`UNIQUE`), `external_roles` (`TEXT[]`, roles de Render como `ADMIN`, `DONANTE`, `ESTUDIANTE`), `local_role` (`VARCHAR(40) NULLABLE`, `'MODERATOR'` o `NULL`), `is_active`, `last_synced_at` y `created_at`.
- **`Actor` (`actors`)**: Perfil social exclusivo para usuarios registrados (relación 1:1 con `UserAccount`); contiene `id` (UUID), `user_account_id` (`UUID UNIQUE FK`), `primary_role`, `first_names`, `last_names`, `avatar_url` y `short_bio`.
- **`ActorConnection` (`actor_connections`)**: Relación de red entre dos perfiles `Actor`; contiene `id` (UUID), `requester_actor_id` (`FK -> actors.id`), `receiver_actor_id` (`FK -> actors.id`), `status` (`PENDING` | `ACCEPTED` | `BLOCKED`), `requested_at` y `accepted_at`.
- **`DeviceSession` (`device_sessions`)**: Sesión local por dispositivo (vinculada opcionalmente a `UserAccount`), con `device_token`, `nickname`, `role_tag`, `consent_accepted_at` y `created_at`.
- **`Category` (`categories`)**: Foro temático público con `id` (UUID), `name` (`UNIQUE`), `main_topic`, `description`, `cover_image_url` y `created_at`.
- **`Post` (`posts`)**: Publicación en un foro con `id` (UUID), `device_id`, `user_account_id` (opcional), `category_id`, `content`, `status` (`PENDING` | `APPROVED` | `REJECTED`), `rejection_reason` (`AUTO_FILTER` | `HUMAN` | `NULL`), `created_at` y `updated_at`.
- **`PostMedia` (`post_media`)**: URLs multimedia asociadas a una publicación (`id` UUID, `post_id` FK en cascada, `media_url`, `display_order`, `created_at`).
- **`Comment` (`comments`)**: Comentario o respuesta en hilo sobre una publicación (`id` UUID, `post_id` FK en cascada, `parent_id` FK opcional a `comments.id`, `device_id`, `user_account_id` opcional, `content`, `status`, `rejection_reason`, `created_at`).
- **`Reaction` (`reactions`)** y **`CommentReaction` (`comment_reactions`)**: Reacciones (`LIKE`, `SUPPORT`, `THANKS`) sobre publicaciones y sobre comentarios respectivamente, únicas por `(target_id, device_id, type)`.
- **`RedirectionLink` (`redirection_links`)** y **`FaqKnowledge` (`faq_knowledge`)**: Catálogo de módulos satélites y base de preguntas frecuentes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los inicios de sesión y registros validan contra el servicio externo en Render una sola vez por sesión y operan subsecuentemente con `device_token` local sin consumir la cuota de 20 peticiones / 15 minutos del servicio externo.
- **SC-002**: El 100% de las publicaciones y comentarios con groserías, enlaces externos, datos de menores o spam son rechazados en el acto (`status = 'REJECTED'`, `rejection_reason = 'AUTO_FILTER'`) y el 100% del resto ingresa en `status = 'PENDING'`, manteniendo 0% de exposición pública sin aprobación de un `ADMIN` o `MODERATOR`.
- **SC-003**: El 95% de los listados paginados responden en menos de 2 segundos devolviendo únicamente URLs para recursos multimedia.

## Assumptions

- **Límite diario para sesiones anónimas**: Por defecto una sesión anónima (`user_account_id = null`) puede crear hasta 3 publicaciones y 10 comentarios por día (parametrizable por variables de entorno `ANON_MAX_POSTS_PER_DAY=3` y `ANON_MAX_COMMENTS_PER_DAY=10`), y puede reaccionar sin límite.
- **Lista inicial del filtro automático**: `ContentFilterService` incluye reglas listas para usar de groserías en español, detección de enlaces (`http://`, `https://`, `www.`), patrones de datos de menores (documentos/teléfonos junto a palabras clave de menores) y spam (repetición excesiva de caracteres o texto sin sentido).
