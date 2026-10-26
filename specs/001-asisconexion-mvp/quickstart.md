# Quickstart Guide: AsisConexión Backend MVP

**Feature**: `001-asisconexion-mvp`
**Stack**: Node.js 20 LTS · NestJS · TypeScript (Strict, zero `any`) · Dual PostgreSQL (TypeORM) · Swagger OpenAPI (`/api/docs`)

---

## 1. Requisitos Previos

- **Node.js** `>= 20.11.0` y **npm** `>= 10.x`
- **PostgreSQL** `>= 15` (base local `asisconexion_db`; `foundation_global_db` opcional cuando `USE_MOCK_EXTERNAL_SERVICES=true`)

---

## 2. Variables de Entorno (`.env`)

Crear `.env` a partir de `.env.example` en la raíz del proyecto (validado al arranque por `src/config/env.validation.ts`):

```dotenv
PORT=3000
NODE_ENV=development

# Base de Datos Propia (ASISCONEXION_DB - Lectura/Escritura principal)
DB_LOCAL_URL=postgresql://postgres:postgres@localhost:5432/asisconexion_db

# Base de Datos General Fundacional (FOUNDATION_GLOBAL_DB - Solo Lectura)
DB_GLOBAL_URL=postgresql://postgres:postgres@localhost:5432/foundation_global_db

# Servicio Central de Autenticación en Render (también acepta alias RENDER_AUTH_API_URL)
RENDER_API_URL=https://auth-central.onrender.com
RENDER_REGISTER_PATH=/auth/registro
RENDER_LOGIN_PATH=/auth/login
RENDER_HTTP_TIMEOUT_MS=5000

# Modo Desarrollo Paralelo con Frontend (LSP Mocks para Render y BD General)
USE_MOCK_EXTERNAL_SERVICES=true

# Seguridad de Sesión Local por Dispositivo
JWT_SECRET=reemplazar_por_secreto_seguro_minimo_32_caracteres
JWT_EXPIRES_IN=30d

# Canal Oficial de Escalamiento Humano (WhatsApp)
WHATSAPP_SUPPORT_PHONE=573001234567
WHATSAPP_DEFAULT_MESSAGE=Hola Fundación Asisco, requiero acompañamiento humano desde AsisConexión.

# Motor del Asistente (faq = Fase 1 activa | rag = Fase 2 stub)
ASSISTANT_ENGINE=faq
CORS_ORIGINS=http://localhost:8081,http://localhost:5173
```

> **Credenciales semilla en modo Mock (`USE_MOCK_EXTERNAL_SERVICES=true`)**:
> `RenderAuthMockAdapter` y `GlobalUserMockRepository` incluyen tres cuentas preexistentes del ecosistema fundacional con clave `ClaveAsisco2026`:
> - `admin.asisco` (`admin@asisco.org`) — Rol `ADMIN` (para moderación en `/v1/auth/sync-session`)
> - `maria.acudiente` (`maria@prueba.com`) — Rol `ACUDIENTE`
> - `carlos.voluntario` (`carlos@asisco.org`) — Rol `VOLUNTARIO`

---

## 3. Instalación, Migraciones, Semillas y Arranque

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar migraciones sobre ASISCONEXION_DB (DataSource 'default')
npm run migration:run

# 3. Cargar datos semilla idempotentes (Categorías, RedirectionLinks y FAQs)
npm run seed:dev

# 4. Iniciar en modo desarrollo
npm run start:dev
```

- **Documentación interactiva OpenAPI (Swagger)**: `http://localhost:3000/api/docs`

---

## 4. Recorrido de Verificación End-to-End (Smoke Test)

### Paso 1: Sesión rápida sin registro (Ley 1581 `accept_consent: true`)
```bash
curl -X POST http://localhost:3000/v1/sessions/anonymous \
  -H "Content-Type: application/json" \
  -d '{"nickname":"AcudienteNorte","role_tag":"ACUDIENTE","accept_consent":true}'
```

### Paso 2: Registro de usuario nuevo sincronizado con Render + `ASISCONEXION_DB`
*(Nota: usa un usuario no precargado en el mock global; si envías `maria.acudiente` comprobarás la respuesta `409 Conflict` RFC 7807).*
```bash
curl -X POST http://localhost:3000/v1/auth/registro \
  -H "Content-Type: application/json" \
  -d '{
    "username":"lucia.acudiente",
    "email":"lucia@prueba.com",
    "clave":"ClaveAcudiente2026",
    "rol":"ACUDIENTE",
    "accept_consent":true
  }'
```

### Paso 2b: Obtener token `ADMIN` sincronizando cuenta fundacional existente
```bash
curl -X POST http://localhost:3000/v1/auth/sync-session \
  -H "Content-Type: application/json" \
  -d '{
    "identifier":"admin.asisco",
    "clave":"ClaveAsisco2026",
    "accept_consent":true
  }'
```

### Paso 3: Crear publicación en foro (nace estrictamente en `PENDING` — RN-02)
```bash
curl -X POST http://localhost:3000/v1/posts \
  -H "Authorization: Bearer <DEVICE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id":"<CATEGORY_UUID>",
    "content":"Comparto nuestra experiencia positiva en los talleres familiares."
  }'
```
- Verificar que `GET http://localhost:3000/v1/posts?page=1&limit=20` **no** expone aún la publicación mientras siga en `PENDING`.

### Paso 4: Moderación por `ADMIN` y visibilidad pública
```bash
curl -X GET "http://localhost:3000/v1/admin/moderation/pending?page=1&limit=20" \
  -H "Authorization: Bearer <ADMIN_DEVICE_TOKEN>"

curl -X PATCH http://localhost:3000/v1/admin/moderation/posts/<POST_UUID>/status \
  -H "Authorization: Bearer <ADMIN_DEVICE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"APPROVED"}'
```
- Verificar que `GET http://localhost:3000/v1/posts?page=1&limit=20` ahora incluye la publicación aprobada.

### Paso 5: Directorio Satélite y Asistente FAQ + Escalamiento WhatsApp
```bash
curl "http://localhost:3000/v1/directory/links?page=1&limit=20"
curl "http://localhost:3000/v1/assistant/faqs?page=1&limit=20"
curl -X POST http://localhost:3000/v1/assistant/escalate \
  -H "Content-Type: application/json" \
  -d '{"topic":"Inscripción SUMA 21"}'
```

---

## 5. Ejecución de Pruebas y Calidad

```bash
# Linter estricto (falla ante cualquier uso de 'any')
npm run lint

# Pruebas unitarias (Servicios, Providers OCP y utilidades de seguridad)
npm run test

# Pruebas de contrato e integración E2E (OpenAPI, RFC 7807, RN-02, RT-01)
npm run test:e2e

# Exportar documento OpenAPI generado en dist/openapi.generated.json
npm run openapi:export
```
