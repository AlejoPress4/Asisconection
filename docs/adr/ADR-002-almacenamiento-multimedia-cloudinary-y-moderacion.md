# ADR-002: Almacenamiento Multimedia mediante Streaming a Cloudinary y Moderación Privilegiada
## AsisConexión Backend (NestJS + TypeScript)

- **Estado**: Aceptado e Implementado
- **Fecha**: 2026-11-09
- **Proyecto**: AsisConexión Backend (NestJS + TypeORM + PostgreSQL)
- **Servidor Objetivo**: Render Web Service (`https://asisconection.onrender.com/v1`)

---

## 1. Contexto

La aplicación móvil AsisConexión requiere que los usuarios puedan subir fotos de perfil y adjuntar imágenes a las publicaciones del foro. Asimismo, se detectó que los administradores y moderadores quedaban bloqueados al publicar contenido porque este se enviaba a la cola de moderación humana (`PENDING`), impidiendo que los anuncios oficiales se visualizaran en tiempo real.

En el backend, el diseño original no contemplaba subida de binarios y existían dos restricciones mayores:
1. **Persistencia Única en PostgreSQL (`ASISCONEXION_DB`):** Almacenar binarios pesados (`BYTEA` o `BLOB`) degradaría el rendimiento de las consultas y aumentaría exponencialmente los costos de almacenamiento en Render/Supabase.
2. **Sistema de Archivos Efímero en Render:** Los contenedores en Render se reinician periódicamente; cualquier archivo almacenado en el disco local (`/uploads` o `public/`) se destruiría tras cada despliegue o reinicio.

---

## 2. Decisiones Arquitectónicas

### Decisión 1: Módulo Aislado `MediaModule` con SDK de Cloudinary
- **Qué se decidió**: Se creó `src/modules/media/` implementando `MediaController` y `MediaService`. La subida se procesa en memoria mediante `multer` (`MemoryStorage`) y se transmite en tiempo real hacia Cloudinary usando `cloudinary.uploader.upload_stream`.
- **Por qué**:
  - Evita escribir archivos temporales en el disco efímero del servidor.
  - La base de datos solo almacena strings con URLs HTTPS seguras y optimizadas (`avatar_url`, `media_url`).
  - Aprovecha la CDN global de Cloudinary para redimensionamiento y entrega ultrarrápida en dispositivos móviles.

### Decisión 2: Auto-aprobación de Contenidos para Roles Privilegiados (`ADMIN` / `MODERATOR`)
- **Qué se decidió**: En `PostsService`, al ejecutar `createPost` o `createComment`, se verifica si la sesión pertenece a un usuario activo con rol `ADMIN` o `MODERATOR` mediante `isPrivilegedModerator(session)`.
- **Por qué**: Si el contenido supera el filtro automático de palabras y no contiene infracciones, se le asigna directamente `status = ModerationStatus.APPROVED`. Esto garantiza que los avisos institucionales aparezcan de forma instantánea sin requerir auto-aprobación posterior.

### Decisión 3: Resolución Dual de Identificadores en `GET /v1/actors/:id/posts`
- **Qué se decidió**: En `PostRepository`, la búsqueda del usuario para un perfil específico se realiza con `WHERE id = $1 OR user_account_id = $1`.
- **Por qué**: Permite que las aplicaciones clientes consulten el muro de publicaciones utilizando indiferentemente el ID del perfil `Actor` o el ID de la cuenta `UserAccount`, eliminando falsos positivos de `404 Not Found`.

### Decisión 4: Formato RFC 7807 en Control de Fallos Multimedia
- **Qué se decidió**: Si las credenciales de Cloudinary no están configuradas o el servicio externo falla, el endpoint responde `502 Bad Gateway` con el estándar RFC 7807 a través de `AllExceptionsFilter`.
- **Por qué**: Evita caídas no controladas del servidor y le informa al cliente móvil de manera estructurada que el problema reside en el proveedor de almacenamiento en la nube y no en los datos enviados.

---

## 3. Consecuencias y Estado

- **Positivo**: Cumplimiento del 100% de los principios constitucionales (Monolito Modular, Persistencia Única, SOLID y RFC 7807).
- **Positivo**: Cero errores de linter (`npm run lint`), 19/19 pruebas unitarias pasando.
- **Operativo**: Requiere configurar las variables `CLOUDINARY_*` en el panel de control de Render antes de habilitar la subida en producción.
