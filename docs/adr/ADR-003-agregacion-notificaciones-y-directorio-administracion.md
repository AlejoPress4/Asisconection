# ADR-003: Agregación de Notificaciones Multievento, Estado de Lectura y Directorio de Administración

* **Estado:** Aceptado e Implementado
* **Fecha:** 2026-11-09
* **Autores:** Equipo de Arquitectura Backend AsisConexión
* **Contexto:**
  1. **Fallo de Autenticación 401 en Notificaciones:**  
     En el despliegue previo en Render, el endpoint `GET /v1/notifications` contaba con la anotación Swagger `@ApiBearerAuth('DeviceSessionBearer')`, pero carecía de la anotación de ejecución `@UseGuards(DeviceSessionGuard)`. Como consecuencia en NestJS, el token Bearer no era procesado por el guardián de sesión, la propiedad `request.sessionContext` llegaba `undefined`, y la llamada a `requireSession(session)` lanzaba inmediatamente un `UnauthorizedException` (HTTP 401). Esto provocaba que tanto peticiones móviles como llamadas manuales desde Swagger fuesen rechazadas.
  2. **Ausencia de Consolidación Multievento y Estado de Lectura:**  
     El servicio de notificaciones no consolidaba los eventos del ecosistema social (likes a publicaciones del actor, comentarios recibidos, respuestas a comentarios propios, nuevos seguidores o avisos de la fundación), ni permitía persistir el estado de lectura al invocar `PATCH /v1/notifications/read-all`.
  3. **Inaccesibilidad del Directorio de Usuarios para Asignación de Moderadores:**  
     El frontend solo disponía de `GET /v1/admin/moderators`, el cual únicamente filtraba a quienes ya contaban con `local_role = 'MODERATOR'`. Los administradores no contaban con un endpoint para buscar usuarios regulares y obtener su `id` (`userAccountId`) para invocación de `PUT /v1/admin/moderators/:userAccountId`.

---

## Decisiones de Diseño

### 1. Corrección del Guardián de Sesión en el Controlador Social
Se aplicó formalmente `@UseGuards(DeviceSessionGuard)` a los métodos:
- `GET /v1/notifications`
- `PATCH /v1/notifications/read-all`

Esto garantiza que `DeviceSessionGuard` valide el `device_token`, recupere la sesión activa en `ASISCONEXION_DB`, resuelva el `actorId` y el `userAccountId`, e inyecte el `SessionContext` antes de la ejecución del controlador.

### 2. Persistencia de Fecha de Lectura en la Entidad `Actor`
Para soportar el marcado de lectura sin requerir una tabla pesada de estados por cada evento:
- Se añadió la columna `last_notifications_read_at` (timestamp con zona horaria, nullable) a la entidad `Actor`.
- Se generó la migración TypeORM `1761520000000-AddLastNotificationsReadAt.ts`.
- En `ActorRepository.onModuleInit()`, se incluyó la ejecución condicional `ALTER TABLE actors ADD COLUMN IF NOT EXISTS last_notifications_read_at TIMESTAMP WITH TIME ZONE;` para garantizar retrocompatibilidad inmediata con bases de datos en Render sin depender exclusivamente de CLI externo.
- `PATCH /v1/notifications/read-all` actualiza esta fecha a la hora actual (`NOW()`) y responde `{ marked_read: true }`.
- Cada notificación calcula dinámicamente `is_read = item.created_at <= lastNotificationsReadAt`.

### 3. Agregación Multievento en `PostRepository`
Se implementó `findAggregatedNotifications(actorId, limit)` que consolida en una sola colección ordenada cronológicamente en orden descendente:
- `LIKE_ON_POST`: Reacciones `LIKE` recibidas en publicaciones aprobadas del actor.
- `COMMENT_ON_POST`: Comentarios aprobados creados por terceros en publicaciones del actor.
- `REPLY_TO_COMMENT`: Respuestas a comentarios donde el autor es el actor.
- `NEW_FOLLOWER`: Solicitudes y conexiones creadas hacia el actor en `actor_connections`.
- `FOUNDATION_ANNOUNCEMENT`: Publicaciones institucionales de la fundación creadas por moderadores/administradores en categorías de aviso.

### 4. Directorio de Cuentas para Moderación (`AdminRoleGuard`)
En `ModerationController`, se expuso:
- `GET /v1/admin/accounts?search=...`: Consulta a `user_accounts` haciendo `LEFT JOIN` con `actors`.
- Permite filtrar por término de búsqueda en `username`, `email` o `display_name`.
- Retorna un listado estructurado `{ items: ModeratorAccountItemDto[], total: number }` con:
  - `id`: ID de la cuenta de usuario (`userAccountId`), requerido para la asignación de moderador.
  - `username`, `email`, `rol` (rol global en Render/Supabase), `local_role` (`USER`, `MODERATOR`, `ADMIN`).
  - `display_name` y `avatar_url` para reconocimiento visual por parte del administrador.

---

## Consecuencias

* **Positivo:** Se erradica por completo el error 401 en notificaciones.
* **Positivo:** La campana de notificaciones del frontend recibe eventos reales de interacción social y refleja con precisión el estado leído/no leído.
* **Positivo:** El frontend puede construir un buscador/directorio administrativo para nombrar moderadores sin quemar identificadores.
* **Mantenibilidad:** Respeta estrictamente los principios SOLID, la Constitución v2.0.0 y los contratos OpenAPI.
