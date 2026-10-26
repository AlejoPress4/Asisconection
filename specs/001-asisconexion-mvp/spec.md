# Feature Specification: AsisConexión MVP

**Feature Branch**: `001-asisconexion-mvp`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Especificación del Sistema (Specify): AsisConexión MVP — Flujo híbrido de identidad con servicio central y persistencia dual, foros temáticos con moderación humana obligatoria, reacciones, directorio de módulos satélites y asistente de orientación FAQ con escalamiento a WhatsApp."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identidad Híbrida y Acceso por Dispositivo con Consentimiento Legal (Priority: P1)

Como acudiente, voluntario, inversor, beneficiario o visitante de la Fundación Asisco, necesito ingresar a AsisConexión ya sea registrando una cuenta fundacional nueva, sincronizando mi cuenta existente del ecosistema general o iniciando una sesión rápida sin registro en mi dispositivo, aceptando expresamente el tratamiento de datos personales para poder interactuar de forma segura.

**Why this priority**: Es la puerta de entrada obligatoria de todo el ecosistema; habilita tanto la participación inmediata sin fricción (modo visitante con sesión por dispositivo) como la identidad única sincronizada con la Fundación y la trazabilidad legal del consentimiento.

**Independent Test**: Se puede probar de forma independiente registrando un usuario nuevo, sincronizando uno existente y creando una sesión anónima, comprobando que en los tres caminos se exige consentimiento, se conserva el perfil local sincronizado sin exponer contraseñas y se entrega una credencial de sesión válida para el dispositivo.

**Acceptance Scenarios**:

1. **Given** una persona usuaria nueva que acepta el consentimiento de datos personales, **When** envía su solicitud de registro en `/v1/auth/registro` con `username`, `email`, `clave`, `rol` y `accept_consent = true`, **Then** el sistema da de alta su identidad en el servicio central de la Fundación, verifica/vincula su referencia maestra, persiste su perfil local (`UserAccount`) y su sesión de dispositivo (`DeviceSession`) con fecha de consentimiento, y devuelve los datos públicos del usuario junto con `device_token` y `synced_with_global_db = true` sin incluir jamás `clave`.
2. **Given** una persona ya registrada previamente en el ecosistema general de la Fundación, **When** solicita iniciar/sincronizar su sesión en `/v1/auth/sync-session`, **Then** el sistema valida su existencia e identidad contra el ecosistema fundacional, crea o actualiza su `UserAccount` (`last_synced_at`) y su `DeviceSession` local, y emite un `device_token` activo.
3. **Given** una persona visitante que desea explorar y participar sin crear cuenta completa, **When** inicia sesión rápida en `/v1/sessions/anonymous` enviando opcionalmente `nickname` y `role_tag` junto con `accept_consent = true`, **Then** el sistema registra la `DeviceSession` con marca de tiempo `consent_accepted_at` y retorna `device_token` y `session_id`.
4. **Given** cualquier intento de registro o inicio de sesión rápida donde `accept_consent` sea falso o esté ausente, **When** se procesa la solicitud, **Then** el sistema rechaza la operación con un mensaje de error claro y no crea sesión ni emite credencial alguna.

---

### User Story 2 - Participación Comunitaria en Foros Temáticos (Priority: P1)

Como miembro de la comunidad con una sesión activa en mi dispositivo (con cuenta registrada o en modo rápido), necesito consultar las categorías temáticas, leer publicaciones aprobadas de forma ágil en mi teléfono o navegador, publicar mensajes o comentarios y expresar apoyo mediante reacciones rápidas.

**Why this priority**: Constituye el valor social central de AsisConexión para conectar familias, voluntarios y beneficiarios en un entorno protegido y optimizado para dispositivos de gama de entrada.

**Independent Test**: Se puede probar con una sesión activa consultando categorías, enviando una publicación y un comentario (verificando que no aparecen públicamente mientras estén pendientes), y aplicando/retirando reacciones sobre publicaciones ya aprobadas.

**Acceptance Scenarios**:

1. **Given** cualquier persona usuaria en la aplicación móvil o Web, **When** consulta `/v1/categories` y `/v1/posts?categoryId={uuid}&page={n}&limit={m}`, **Then** recibe listados paginados y ligeros que incluyen únicamente publicaciones con estado `APPROVED`, mostrando el nombre visible (`username` o `nickname`) y etiqueta de rol (`rol` o `role_tag`) del autor.
2. **Given** una persona con `DeviceSession` válida (vinculada o no a `UserAccount`), **When** crea una publicación en `/v1/posts` o un comentario en `/v1/posts/:postId/comments`, **Then** el registro se almacena estrictamente con estado `PENDING`, asociando `device_id` y `user_account_id` (cuando aplique), e informando que quedará visible tras revisión humana.
3. **Given** una persona con `DeviceSession` válida visualizando una publicación aprobada, **When** envía una reacción (`LIKE`, `SUPPORT` o `THANKS`) a `/v1/posts/:postId/reactions`, **Then** el sistema registra la reacción si no existía para esa combinación `(post_id, device_id, type)` o la elimina si ya existía, evitando duplicados.

---

### User Story 3 - Moderación Humana de Contenidos por Administradores (Priority: P1)

Como administrador de la Fundación Asisco, necesito revisar la cola de publicaciones y comentarios pendientes y aprobarlos o rechazarlos para proteger a menores de edad, familias y beneficiarios antes de que cualquier contenido sea público.

**Why this priority**: Es indispensable tanto para cumplir la regla de negocio de protección comunitaria (RN-02) como para que las publicaciones creadas en la Historia de Usuario 2 puedan llegar al muro público.

**Independent Test**: Se puede probar autenticando un usuario con rol `ADMIN`, listando los elementos en `PENDING`, aprobando uno y rechazando otro, y comprobando que solo el aprobado pasa a ser visible en el listado público.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado cuyo perfil posee rol `ADMIN` verificado frente a `UserAccount` y el registro fundacional general, **When** consulta `/v1/admin/moderation/pending`, **Then** recibe de forma paginada las publicaciones y comentarios que permanecen en estado `PENDING`.
2. **Given** una publicación o comentario en estado `PENDING`, **When** un administrador actualiza su estado en `/v1/admin/moderation/posts/:id/status` o `/v1/admin/moderation/comments/:id/status` a `APPROVED` o `REJECTED`, **Then** el nuevo estado persiste inmediatamente y únicamente los elementos `APPROVED` se exponen en las consultas públicas.
3. **Given** una sesión anónima o un usuario registrado con rol distinto de `ADMIN` (por ejemplo, `ACUDIENTE` o `VOLUNTARIO`), **When** intenta acceder a cualquier ruta de `/v1/admin/moderation/*`, **Then** el sistema deniega el acceso sin exponer información interna de moderación.

---

### User Story 4 - Directorio de Redireccionamiento a Módulos Satélites (Priority: P2)

Como persona usuaria de la Fundación Asisco, necesito consultar el directorio oficial de programas y plataformas satélites (como SUMA 21, AULA UP y SAGA-UP) y abrirlos directamente de forma nativa fuera de AsisConexión sin marcos superpuestos ni vistas embebidas confusas.

**Why this priority**: Posiciona a AsisConexión como punto de acceso unificado hacia todo el portafolio digital de la Fundación manteniendo una experiencia ligera y clara en equipos básicos.

**Independent Test**: Se puede probar consultando el directorio y verificando que solo se entregan enlaces activos con su nombre de proyecto, descripción y dirección externa limpia lista para apertura nativa.

**Acceptance Scenarios**:

1. **Given** enlaces registrados en el directorio donde algunos están activos y otros inactivos, **When** una persona consulta `/v1/directory/links`, **Then** recibe únicamente los enlaces con `is_active = true` (ej. `SUMA 21`, `AULA UP`, `SAGA-UP`) con URLs externas limpias aptas para apertura nativa sin superposición.

---

### User Story 5 - Orientación por Preguntas Frecuentes y Escalamiento Humano vía WhatsApp (Priority: P2)

Como acudiente o beneficiario que busca orientación rápida sobre trámites, programas o servicios de la Fundación, necesito consultar respuestas claras de preguntas frecuentes con aviso transparente de asistencia automatizada y contar con un botón directo para escalar mi caso a atención humana por WhatsApp cuando requiera acompañamiento personalizado.

**Why this priority**: Resuelve dudas recurrentes al instante las 24 horas y garantiza una ruta cálida y directa hacia el equipo humano de la Fundación cuando el caso supera las preguntas frecuentes.

**Independent Test**: Se puede probar consultando el catálogo de preguntas frecuentes (comprobando la presencia del descargo informativo) y solicitando el escalamiento para verificar la generación del enlace válido hacia WhatsApp.

**Acceptance Scenarios**:

1. **Given** una base de preguntas frecuentes organizadas por categoría, **When** la persona consulta `/v1/assistant/faqs`, **Then** obtiene los registros de orientación junto con el aviso explícito (*disclaimer*) que indica el alcance informativo del asistente automatizado.
2. **Given** una persona que necesita atención personalizada de la Fundación, **When** solicita escalamiento en `/v1/assistant/escalate`, **Then** recibe un enlace externo limpio de redireccionamiento hacia el canal oficial de WhatsApp de atención humana.

---

### Edge Cases

- **Indisponibilidad o rechazo del servicio central de identidad**: Cuando el servicio externo de autenticación no responde, supera el tiempo de espera o rechaza un registro por usuario/correo ya existente, el sistema responde con un error estandarizado comprensible (502 ante fallo del servicio externo o 409 ante conflicto de identidad duplicada) y **nunca** emite un `device_token` local sin haber asegurado primero la persistencia del perfil local.
- **Consistencia entre registro fundacional general y perfil local**: Si un usuario existe en el registro maestro fundacional (`FOUNDATION_GLOBAL_DB`) pero aún no tiene espejo en `ASISCONEXION_DB`, el flujo de sincronización crea el registro `UserAccount` local antes de vincular `DeviceSession`; si el usuario está marcado como inactivo (`is_active = false`), se impide la emisión o uso de sesión autenticada.
- **Transición de visitante anónimo a usuario registrado en el mismo dispositivo**: Si el dispositivo ya poseía una `DeviceSession` anónima activa y la persona se registra o sincroniza su cuenta, la sesión local puede vincularse al nuevo `UserAccount` actualizando `nickname` y `role_tag` con `username` y `rol` sin perder la trazabilidad previa del dispositivo.
- **Intento de manipulación de estados o ausencia de consentimiento legal**: Si un cliente intenta enviar `status = 'APPROVED'` al crear una publicación/comentario, el sistema ignora o rechaza dicho valor e impone `status = 'PENDING'`. Asimismo, si se intenta crear sesión o adjuntar imagen (`image_url`) vinculada a menores/beneficiarios sin registro válido de `consent_accepted_at`, la operación se bloquea.
- **Interacciones sobre contenidos no públicos o inexistentes**: No se permite comentar ni reaccionar públicamente sobre publicaciones inexistentes o cuyo estado sea `PENDING` o `REJECTED`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer `POST /v1/auth/registro` recibiendo `{ username, email, clave, rol, accept_consent }`, registrar primero al usuario en el servicio central de autenticación (`POST /auth/registro` con `{ username, email, clave, rol }`), verificar su referencia maestra en el registro general fundacional cuando corresponda, persistir/actualizar `UserAccount` en la base propia sin almacenar jamás `clave`, registrar `DeviceSession` con `consent_accepted_at` y retornar `{ user: { id, username, email, rol }, device_token, synced_with_global_db }`.
- **FR-002**: El sistema DEBE exponer `POST /v1/auth/sync-session` para autenticar/verificar usuarios existentes en el ecosistema general de la Fundación y sincronizar de forma persistente su `UserAccount` (`last_synced_at`) y su `DeviceSession` local antes de entregar el `device_token`.
- **FR-003**: El sistema DEBE exponer `POST /v1/sessions/anonymous` recibiendo `{ nickname?, role_tag?, accept_consent }`, exigiendo `accept_consent = true` para registrar `consent_accepted_at` y devolviendo `{ device_token, session_id }`.
- **FR-004**: Cuando una `DeviceSession` esté vinculada a un `UserAccount`, el sistema DEBE asignar por defecto `nickname = UserAccount.username` y `role_tag = UserAccount.rol` salvo configuración válida permitida por negocio.
- **FR-005**: El sistema DEBE exponer `GET /v1/categories` y `GET /v1/posts?categoryId={uuid}&page={n}&limit={m}` con paginación obligatoria, retornando en el muro público exclusivamente publicaciones con `status = 'APPROVED'` junto con la identificación pública del autor (`username`/`nickname` y `rol`/`role_tag`), conteo de reacciones y comentarios aprobados asociados.
- **FR-006**: El sistema DEBE exponer `POST /v1/posts` protegido por sesión de dispositivo válida, forzando incondicionalmente `status = 'PENDING'` y registrando tanto `device_id` como `user_account_id` (cuando la sesión pertenezca a un usuario registrado).
- **FR-007**: El sistema DEBE exponer `POST /v1/posts/:postId/comments` protegido por sesión de dispositivo válida sobre publicaciones aprobadas, creando todo comentario estrictamente con `status = 'PENDING'` y vinculando `device_id` y `user_account_id` (si aplica).
- **FR-008**: El sistema DEBE exponer `POST /v1/posts/:postId/reactions` protegido por sesión de dispositivo válida para alternar (registrar si no existe o eliminar si ya existe) una reacción de tipo `LIKE`, `SUPPORT` o `THANKS`, garantizando unicidad por combinación `(post_id, device_id, type)`.
- **FR-009**: El sistema DEBE restringir todas las operaciones de `/v1/admin/moderation/*` exclusivamente a usuarios autenticados activos cuyo rol `ADMIN` esté verificado contra `UserAccount` y el registro general fundacional.
- **FR-010**: El sistema DEBE exponer `GET /v1/admin/moderation/pending` (paginado) para listar publicaciones y comentarios en estado `PENDING`, así como `PATCH /v1/admin/moderation/posts/:id/status` y `PATCH /v1/admin/moderation/comments/:id/status` para transicionar su estado a `APPROVED` o `REJECTED`.
- **FR-011**: El sistema DEBE exponer `GET /v1/directory/links` retornando de forma ligera y paginada únicamente los registros `RedirectionLink` con `is_active = true` y URLs externas limpias para apertura nativa fuera de la aplicación.
- **FR-012**: El sistema DEBE exponer `GET /v1/assistant/faqs` retornando las entradas de `FaqKnowledge` (filtrables por categoría y paginadas) acompañadas siempre de un aviso (*disclaimer*) explícito sobre el carácter orientativo del asistente, y `POST /v1/assistant/escalate` devolviendo el enlace directo de atención humana vía WhatsApp.
- **FR-013**: Toda respuesta de error funcional, de validación, de autorización o de comunicación con servicios externos DEBE entregarse en formato homologado de detalle de problemas (RFC 7807), traduciendo rechazos por duplicidad a conflicto (409) e indisponibilidad del servicio central a pasarela incorrecta (502).

### Constitutional & Compliance Constraints *(mandatory where applicable)*

- **CC-001 (Segregación de Contratos y Confidencialidad — ISP)**: Los contratos públicos de entrada y salida DEBEN excluir de forma absoluta el campo `clave` y cualquier credencial interna; los datos enviados al servicio central (`username`, `email`, `clave`, `rol`) y las vistas administrativas de moderación DEBEN mantenerse estrictamente separados de las respuestas públicas.
- **CC-002 (Rendimiento para Gama de Entrada — RT-01)**: Todos los listados (`categories`, `posts`, `moderation/pending`, `directory/links`, `assistant/faqs`) DEBEN aplicar paginación obligatoria con límites acotados y cargas de datos livianas aptas para teléfonos básicos y conexiones móviles limitadas.
- **CC-003 (Moderación Humana Obligatoria — RN-02)**: Ningún `Post` ni `Comment` puede nacer ni actualizarse por acción de un usuario no administrador a un estado distinto de `PENDING`, y ningún canal público puede exponer contenidos cuyo estado no sea exactamente `APPROVED`.
- **CC-004 (Cumplimiento Ley 1581 de 2012 y Ley 1098 de 2006 — Colombia)**: Toda creación de sesión (`DeviceSession`) y toda carga o referencia de imagen (`image_url`) vinculada a menores de edad o beneficiarios DEBE contar con aceptación expresa y trazabilidad persistente en `consent_accepted_at`.
- **CC-005 (Evolución Abierta del Asistente — OCP)**: Las capacidades de orientación de Fase 1 basadas en preguntas frecuentes (`FaqKnowledge`) DEBEN exponerse mediante un contrato estable que permita incorporar búsqueda semántica/multimodal en Fase 2 sin alterar la experiencia ni los contratos consumidos por los clientes móviles y Web.

### Key Entities *(include if feature involves data)*

- **`external_user` (Registro Maestro en Base General Fundacional)**: Representa la identidad base gestionada a nivel fundacional (`id`/`username`, `email`, `rol` como `ACUDIENTE`, `ADMIN`, `VOLUNTARIO`, `INVERSOR`), consultada en modo solo lectura para verificación cruzada de cuentas y permisos.
- **`UserAccount` (Cuenta Local Sincronizada)**: Espejo persistente del usuario fundacional dentro de AsisConexión que asegura integridad referencial local; contiene `id` único, `external_user_id` opcional único, `username` único (máx. 80 caracteres), `email` único (máx. 120 caracteres), `rol` (máx. 40 caracteres), indicador `is_active` (activo por defecto), fecha de última sincronización (`last_synced_at`) y fecha de creación (`created_at`), sin almacenar nunca contraseñas.
- **`DeviceSession` (Sesión por Dispositivo)**: Representa la sesión activa de un teléfono o navegador con o sin cuenta registrada; vincula opcionalmente `user_account_id` (si la cuenta se elimina, la referencia queda nula sin romper el historial), almacena `device_token` único, `nickname` opcional (máx. 50 caracteres, toma `username` si hay cuenta), `role_tag` opcional (máx. 40 caracteres, toma `rol` si hay cuenta), marca obligatoria de consentimiento `consent_accepted_at` y `created_at`.
- **`Category` (Categoría de Foro Temático)**: Agrupa temáticas de conversación comunitaria mediante `id`, `name` único (máx. 80 caracteres), `description` y `created_at`.
- **`Post` (Publicación Comunitaria)**: Mensaje publicado en un foro temático; referencia obligatoriamente `device_id` y `category_id`, opcionalmente `user_account_id`, contiene `content`, `image_url` opcional, `status` (`PENDING`, `APPROVED`, `REJECTED` con valor inicial obligatorio `PENDING`) y marcas `created_at` / `updated_at`.
- **`Comment` (Comentario en Hilo)**: Respuesta asociada a una publicación (`post_id`, se elimina en cascada si se elimina la publicación), vinculada a `device_id` y opcionalmente a `user_account_id`, con texto `content`, `status` (`PENDING`, `APPROVED`, `REJECTED`, por defecto `PENDING`) y `created_at`.
- **`Reaction` (Reacción Rápida)**: Interacción breve de apoyo comunitario asociada a una publicación (`post_id`, borrado en cascada), `device_id`, `user_account_id` opcional y `type` (`LIKE`, `SUPPORT`, `THANKS`), restringida a una única reacción por combinación `(post_id, device_id, type)`.
- **`RedirectionLink` (Enlace de Directorio Satélite)**: Entrada del catálogo hacia plataformas hermanas de la Fundación (`project_name` hasta 100 caracteres como `SUMA 21`, `AULA UP`, `SAGA-UP`, `url` externa limpia, `description`, bandera `is_active` activa por defecto y `created_at`).
- **`FaqKnowledge` (Conocimiento de Preguntas Frecuentes)**: Par pregunta-respuesta oficial para orientación en Fase 1 (`question`, `answer`, `category` hasta 60 caracteres y `created_at`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Personas usuarias nuevas, registradas previamente o visitantes anónimas completan el inicio de sesión y aceptación de consentimiento de datos en menos de 60 segundos desde que abren la aplicación o sitio Web.
- **SC-002**: El 100% de los registros y sincronizaciones exitosas reflejan consistencia entre la identidad fundacional y el perfil local antes de habilitar la sesión del dispositivo, con 0 exposiciones de contraseñas o credenciales internas en respuestas o historiales visibles.
- **SC-003**: El 100% de las publicaciones y comentarios creados por usuarios ingresan en cola de revisión humana (`PENDING`), garantizando un 0% de exposición pública de contenidos pendientes o rechazados.
- **SC-004**: El 95% de las consultas a listados paginados (categorías, muro de publicaciones aprobadas, directorio satélite, preguntas frecuentes y bandeja de moderación) entregan resultados completos y livianos en menos de 2 segundos bajo condiciones de red móvil estándar en equipos de gama de entrada.
- **SC-005**: Un administrador autenticado revisa la cola pendiente y ejecuta la aprobación o rechazo de una publicación o comentario en menos de 30 segundos, reflejando de inmediato el cambio en la visibilidad pública del muro.
- **SC-006**: El 100% de las respuestas del módulo de orientación incluyen de forma visible el descargo informativo de asistencia automatizada y permiten abrir la atención humana por WhatsApp o los proyectos satélites externos en un solo paso sin superposición dentro de la interfaz.

## Assumptions

- **Sincronización e inicio de sesión de cuenta existente (`/v1/auth/sync-session`)**: Se asume que acepta credenciales válidas del usuario fundacional (`username` o `email` + `clave`, o validación equivalente admitida por el servicio central) junto con `accept_consent = true` cuando se genera una nueva `DeviceSession`, y permite asociar opcionalmente una sesión de dispositivo previa si se envía el encabezado de sesión vigente.
- **Identificación visible en sesiones anónimas**: Si una persona inicia sesión rápida sin indicar `nickname` ni `role_tag`, el sistema permite almacenarlos vacíos y presentar en vistas públicas una etiqueta amigable por defecto (por ejemplo, `"Participante"` / `"VISITANTE"`).
- **Parámetros de paginación por defecto (RT-01)**: Cuando el cliente no especifique `page` o `limit` en cualquier endpoint de listado, se aplicará `page = 1` y `limit = 20`, con un tope máximo de `50` registros por página para proteger el consumo de memoria y datos móviles en equipos de gama de entrada.
- **Visualización de comentarios aprobados**: La consulta pública de publicaciones incluye únicamente conteos o hilos de comentarios cuyo estado sea `APPROVED` (nunca `PENDING` ni `REJECTED`), manteniendo paginación acotada cuando se consulten hilos extensos.
- **Gestión de imágenes en el MVP**: El campo `image_url` en `Post` recibe una URL previamente alojada/validada por el canal autorizado de medios de la plataforma, exigiendo que la sesión cuente con `consent_accepted_at` vigente en cumplimiento de la Ley 1581 de 2012 y Ley 1098 de 2006.
- **Canal de escalamiento a WhatsApp**: El número oficial de atención humana y el mensaje base de bienvenida de la Fundación Asisco se parametrizan mediante configuración del entorno operativo sin requerir cambios en la aplicación cliente.
