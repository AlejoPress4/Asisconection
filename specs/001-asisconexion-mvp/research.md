# Phase 0 Research: AsisConexión MVP (v2 — Persistencia Única e Identidad HTTP)

**Feature**: `001-asisconexion-mvp`
**Date**: 2026-10-27
**Status**: Complete (0 unresolved clarifications)

---

## 1. Contrato Probado del Servicio Central en Render/Supabase y Eliminación de `FOUNDATION_GLOBAL_DB`

- **Decision**: Eliminar la conexión directa `FOUNDATION_GLOBAL_DB` (`global_db`) y operar con una única base de datos PostgreSQL (`ASISCONEXION_DB`) + consumo HTTP del servicio real `https://proyecto-integrador-backend-g2.onrender.com` a través de `IExternalAuthAdapter`.
- **Hallazgos empíricos de las pruebas contra Render**:
  - `POST /auth/login` recibe `{ email, clave }` y responde `200 { token, expiraEn, usuario: { usuarioId: number, username, email, fechaCreacion, roles: string[] } }`. En error responde `{ error: "Correo o contraseña incorrectos" }`.
  - `GET /auth/perfil` con `Authorization: Bearer <token>` responde `{ usuarioId, sesionId, username, roles[] }`.
  - El `token` emitido por Render es **opaco** (8 horas de vigencia) y el servicio aplica un **rate limit de 20 peticiones cada 15 minutos**.
- **Rationale**: Validar el token externo en cada petición agotaría rápidamente las 20 peticiones por ventana de 15 minutos. Al validar contra Render únicamente durante `/v1/auth/login` y `/v1/auth/registro`, sincronizar `UserAccount` (`external_user_id` numérico, `external_roles[]`) + `Actor` 1:1 en `ASISCONEXION_DB` y emitir un JWT `device_token` local propio, el sistema logra latencia mínima y cero bloqueos por rate-limit.

---

## 2. Roles de Administración (`ADMIN`) y Moderadores Globales (`MODERATOR`)

- **Decision**:
  - Si `UserAccount.external_roles` contiene `'ADMIN'`, el usuario tiene privilegios completos de `ADMIN` en AsisConexión de forma automática.
  - Los administradores (`ADMIN`) pueden asignar o revocar `UserAccount.local_role = 'MODERATOR'` mediante `/v1/admin/moderators/*`.
  - `RolesGuard` permite el acceso a `/v1/admin/moderation/*` tanto a `ADMIN` como a `MODERATOR`, mientras que restringe `/v1/admin/moderators/*` exclusivamente a `ADMIN`.

---

## 3. Moderación en Dos Capas: `ContentFilterService` (`IContentRule`) + Revisión Humana (`RN-02`)

- **Decision**: Todo `Post` y `Comment` entrante se evalúa de forma síncrona mediante `ContentFilterService`, que itera sobre proveedores `IContentRule` (`ProfanityContentRule`, `ExternalLinkContentRule`, `MinorDataContentRule`, `SpamContentRule`):
  - Si alguna regla coincide, el registro se guarda en `ASISCONEXION_DB` con `status = 'REJECTED'` y `rejection_reason = 'AUTO_FILTER'`.
  - Si ninguna regla coincide, se guarda con `status = 'PENDING'` y `rejection_reason = null` para revisión humana por `ADMIN` o `MODERATOR`.
  - Adicionalmente, las sesiones anónimas (`user_account_id = null`) tienen un límite diario configurable (por defecto 3 posts y 10 comentarios en 24h por `device_id`), pero pueden reaccionar sin límite.

---

## 4. Perfiles `Actor`, Red `ActorConnection`, Multimedia por URLs e Hilos de Comentarios

- **Decision**:
  - Crear las entidades `Actor` (1:1 con `UserAccount`, exclusivo para usuarios registrados) y `ActorConnection` (`PENDING`, `ACCEPTED`, `BLOCKED`).
  - Ampliar `Category` con `main_topic` y `cover_image_url` (todos los foros son públicos).
  - Soportar múltiples URLs por publicación mediante `PostMedia` (`media_urls: string[]`).
  - Soportar hilos de comentarios mediante `Comment.parent_id` y reacciones en comentarios mediante `CommentReaction`.
  - Retirar el alcance/stub de RAG (`RagMultimodalProviderStub`) conservando la interfaz `IAssistantEngineProvider` con `FaqRuleEngineProvider`.
