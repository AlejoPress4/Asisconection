# Quickstart Guide: AsisConexión Backend MVP (v2)

**Feature**: `001-asisconexion-mvp`
**Stack**: Node.js 20 LTS · NestJS · TypeScript (Strict, zero `any`) · Single PostgreSQL (`ASISCONEXION_DB` TypeORM) · Render/Supabase HTTP Auth · Swagger OpenAPI (`/api/docs`)

---

## 1. Requisitos Previos

- **Node.js** `>= 20.11.0` y **npm** `>= 10.x`
- **PostgreSQL** `>= 15` (base de datos única `asisconexion_db`)

---

## 2. Variables de Entorno (`.env`)

Crear `.env` a partir de `.env.example` en la raíz del proyecto:

```dotenv
PORT=3000
NODE_ENV=development

# Base de Datos Propia Única (ASISCONEXION_DB)
DB_LOCAL_URL=postgresql://postgres:postgres@localhost:5432/asisconexion_db

# Servicio Central de Autenticación en Render/Supabase
RENDER_API_URL=https://proyecto-integrador-backend-g2.onrender.com
RENDER_REGISTER_PATH=/auth/registro
RENDER_LOGIN_PATH=/auth/login
RENDER_PROFILE_PATH=/auth/perfil
RENDER_HTTP_TIMEOUT_MS=5000

# Modo Desarrollo Paralelo con Frontend (LSP Mock para Render)
USE_MOCK_EXTERNAL_SERVICES=true

# Seguridad de Sesión Local por Dispositivo
JWT_SECRET=reemplazar_por_secreto_seguro_minimo_32_caracteres
JWT_EXPIRES_IN=30d

# Cuotas Diarias para Sesiones Anónimas
ANON_MAX_POSTS_PER_DAY=3
ANON_MAX_COMMENTS_PER_DAY=10

# Canal Oficial de Escalamiento Humano (WhatsApp)
WHATSAPP_SUPPORT_PHONE=573001234567
WHATSAPP_DEFAULT_MESSAGE=Hola Fundación Asisco, requiero acompañamiento humano desde AsisConexión.

# Motor del Asistente (faq = Fase 1 activa)
ASSISTANT_ENGINE=faq
CORS_ORIGINS=http://localhost:8081,http://localhost:5173
```

---

## 3. Instalación, Migraciones, Semillas y Arranque

```bash
npm install
npm run migration:run
npm run seed:dev
npm run start:dev
```

- **Documentación interactiva OpenAPI (Swagger)**: `http://localhost:3000/api/docs`

---

## 4. Recorrido de Verificación End-to-End (Smoke Test v2)

### Paso 1: Login unificado contra Render/Supabase (`/v1/auth/login`)
```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@asisco.org","clave":"ClaveAsisco2026","accept_consent":true}'
```

### Paso 2: Consultar y actualizar perfil `Actor` (solo usuarios registrados)
```bash
curl -X PATCH http://localhost:3000/v1/actors/me \
  -H "Authorization: Bearer <USER_DEVICE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"first_names":"María","last_names":"Gómez","short_bio":"Acudiente activa en talleres."}'
```

### Paso 3: Publicar con URLs multimedia y probar Filtro Automático (`ContentFilterService`)
```bash
# Pasa a PENDING:
curl -X POST http://localhost:3000/v1/posts \
  -H "Authorization: Bearer <DEVICE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"category_id":"<CATEGORY_UUID>","content":"Excelente jornada comunitaria hoy.","media_urls":["https://cdn.asisco.org/fotos/1.jpg"]}'

# Rechazo inmediato (REJECTED con rejection_reason = AUTO_FILTER) por enlace externo:
curl -X POST http://localhost:3000/v1/posts \
  -H "Authorization: Bearer <DEVICE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"category_id":"<CATEGORY_UUID>","content":"Visiten https://sitio-externo.com ahora"}'
```

### Paso 4: Gestión de Moderadores Globales (solo `ADMIN`) y Moderación (`ADMIN` o `MODERATOR`)
```bash
curl -X PUT http://localhost:3000/v1/admin/moderators/<USER_ACCOUNT_UUID> \
  -H "Authorization: Bearer <ADMIN_DEVICE_TOKEN>"
```

---

## 5. Ejecución de Pruebas y Calidad

```bash
npm run lint
npm run test
npm run test:e2e
```
