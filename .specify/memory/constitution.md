<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0 (MAJOR: eliminación de FOUNDATION_GLOBAL_DB y persistencia dual a favor de Persistencia Única en ASISCONEXION_DB + Servicio Central de Identidad HTTP en Render/Supabase; retiro del alcance RAG en Fase 2; unificación de adaptador a IExternalAuthAdapter; incorporación de filtro automático previo con IContentRule y rol MODERATOR local/global).
- Modified principles:
  - II. Persistencia Dual Activa e Integración con API Central → II. Persistencia Única Activa e Integración con Servicio Central de Identidad (HTTP)
  - III. Responsabilidad Única por Capa (SOLID — SRP) → III. Responsabilidad Única por Capa (SOLID — SRP) (actualizado para reflejar una única BD PostgreSQL y reglas de filtro automático)
  - IV. Extensibilidad Abierta/Cerrada en Asistencia Inteligente (SOLID — OCP) → IV. Extensibilidad Abierta/Cerrada en Asistencia y Filtrado de Contenido (SOLID — OCP)
  - V. Sustitución, Segregación de Contratos e Inversión de Dependencias (SOLID — LSP, ISP, DIP) → V. Sustitución, Segregación de Contratos e Inversión de Dependencias (SOLID — LSP, ISP, DIP) (unificado a IExternalAuthAdapter)
- Added sections:
  - Reglas de Moderación en Dos Capas (Filtro Automático + Revisión Humana RN-02) y Rol MODERATOR en "Seguridad, Moderación y Cumplimiento Legal en Colombia"
- Removed sections:
  - Referencias a conexión directa PostgreSQL `FOUNDATION_GLOBAL_DB` y obligación de `RagMultimodalProvider` en Fase 2.
- Templates requiring updates:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ✅ updated: .specify/templates/tasks-template.md
  - ✅ updated: AGENTS.md
  - ✅ verified (no changes needed): .specify/templates/checklist-template.md
- Follow-up TODOs:
  - Propagar cambios a specs/001-asisconexion-mvp/ (spec.md, plan.md, data-model.md, contracts/, tasks.md) y refactorizar código en src/ y test/.
-->

# Constitución del Proyecto: AsisConexión Backend

## Principios Fundamentales

### I. Identidad Arquitectónica: Monolito Modular y SDD OpenAPI-First

- **Patrón Base**: El sistema DEBE construirse como un **Monolito Modular estricto** en
  **NestJS** con **TypeScript**, manteniendo límites explícitos entre dominios funcionales.
- **Metodología Spec-Driven Development (SDD)**: Todo endpoint interno o integración externa
  DEBE tener su contrato definido previamente en `@nestjs/swagger` (DTOs tipados y decoradores
  OpenAPI completos) antes de codificar cualquier lógica de negocio.

**Justificación**: Definir contratos OpenAPI antes de implementar garantiza alineación temprana
con el equipo de Frontend, evita deriva entre documentación y código, y preserva el orden
modular del monolito a medida que crece el dominio.

### II. Persistencia Única Activa e Integración con Servicio Central de Identidad (HTTP)

- El backend DEBE operar coordinando su propia base de datos PostgreSQL con el servicio central
  de identidad de la Fundación desplegado en Render (respaldado por Supabase):
  1. **Servicio Central de Identidad en Render (`RENDER_AUTH_API_URL`)**: Consumo HTTP activo
     mediante `@nestjs/axios` de los endpoints fundacionales (`POST /auth/login`,
     `POST /auth/registro`, `GET /auth/perfil`). Debido al límite de peticiones del servicio
     externo, el token opaco externo DEBE validarse en el inicio de sesión o registro para
     sincronizar `UserAccount` (`external_user_id` numérico y `external_roles[]`) y emitir
     posteriormente un `device_token` local propio para las operaciones del ecosistema.
  2. **Base de Datos Propia (`ASISCONEXION_DB`)**: Única conexión PostgreSQL del sistema
     (con identificadores UUID) donde DEBEN persistir sincronizados los usuarios (`UserAccount`
     con `external_roles[]` y `local_role`), los perfiles de usuarios registrados (`Actor`) y
     sus conexiones (`ActorConnection`), las sesiones de dispositivos (`DeviceSession`), las
     entidades de red social (`Category`, `Post`, `PostMedia`, `Comment` con soporte de hilos
     vía `parent_id`, `Reaction`, `CommentReaction`), directorio (`RedirectionLink`) y
     asistente (`FaqKnowledge`). Queda PROHIBIDA cualquier conexión directa a bases de datos
     externas fuera del servicio HTTP de identidad.

**Justificación**: Elimina el acoplamiento a esquemas internos de bases de datos de otros
equipos, respeta los límites de tasa (*rate limits*) del servicio central en Render/Supabase
mediante sesiones locales rápidas y concentra toda la riqueza social en `ASISCONEXION_DB`.

### III. Responsabilidad Única por Capa (SOLID — SRP)

- Cada capa técnica DEBE cumplir una única responsabilidad sin invadir responsabilidades
  vecinas:
  - **Controladores (`*.controller.ts`)**: Solo DEBEN gestionar enrutamiento HTTP, códigos de
    estado, validación declarativa de DTOs y decoradores `@nestjs/swagger`. Queda PROHIBIDO
    incluir reglas de negocio o acceso a datos en controladores.
  - **Servicios de Dominio (`*.service.ts`)**: DEBEN orquestar las reglas de negocio (ej.
    sincronizar `UserAccount` y `Actor` tras autenticar con Render, ejecutar el filtro
    automático de contenido previo y asignar `status = 'PENDING'` o `status = 'REJECTED'`).
  - **Adaptadores Externos (`*.adapter.ts`)**: DEBEN aislar por completo las llamadas HTTP
    hacia `RENDER_AUTH_API_URL` y la traducción de sus respuestas (`{ token, expiraEn, usuario }`)
    o fallos de red/negocio (`{ error }`).
  - **Repositorios (`*.repository.ts`)**: DEBEN aislar las operaciones TypeORM dirigidas a
    `ASISCONEXION_DB`.

**Justificación**: El aislamiento estricto entre transporte, negocio, red externa y TypeORM
reduce el acoplamiento accidental y permite probar cada capa de forma independiente.

### IV. Extensibilidad Abierta/Cerrada en Asistencia y Filtrado de Contenido (SOLID — OCP)

- **Asistente Orientativo**: El módulo `AssistantModule` DEBE operar mediante un motor
  determinista de preguntas frecuentes (`FaqRuleEngineProvider`) expuesto a través de la
  abstracción `IAssistantEngineProvider`. Se descarta la implementación de RAG en el alcance
  actual por criterios presupuestales, pero la interfaz `IAssistantEngineProvider` DEBE
  conservarse abierta a futuros motores sin modificar controladores ni contratos HTTP.
- **Filtro Automático de Contenido**: El servicio `ContentFilterService` DEBE evaluar reglas
  modulares mediante la interfaz `IContentRule` (groserías, enlaces externos, datos de menores
  y spam), permitiendo agregar nuevas reglas de detección sin modificar el orquestador.

**Justificación**: Mantiene costos operativos bajos hoy mientras protege la arquitectura para
agregar nuevos motores de respuesta o reglas de protección infantil sin retrabajo.

### V. Sustitución, Segregación de Contratos e Inversión de Dependencias (SOLID — LSP, ISP, DIP)

- **Liskov Substitution Principle (LSP)**: El adaptador hacia el servicio de identidad en Render
  (`IExternalAuthAdapter`) y los repositorios de `ASISCONEXION_DB` DEBEN poder sustituirse
  limpiamente por `Mocks` durante las pruebas y el desarrollo paralelo con Frontend sin alterar
  los contratos JSON ni la semántica esperada.
- **Interface Segregation Principle (ISP)**: Se DEBEN separar estrictamente los DTOs públicos
  de entrada/salida, los payloads enviados hacia Render (`username`, `email`, `clave`, `rol`)
  y las estructuras internas de moderación. Queda terminantemente PROHIBIDO exponer el campo
  `clave` o tokens internos en respuestas públicas o logs.
- **Dependency Inversion Principle (DIP)**: Los servicios de alto nivel DEBEN depender
  exclusivamente de interfaces (`IExternalAuthAdapter`, `IUserSyncRepository`,
  `IAssistantEngineProvider`, `IContentRule`) inyectadas mediante tokens explícitos de NestJS,
  nunca de implementaciones concretas.

**Justificación**: Unifica la nomenclatura de contratos internos, protege credenciales sensibles
por diseño y desacopla el núcleo de negocio respecto a fallos o límites de tasa externos.

## Reglas de Clean Code, Calidad y Rendimiento

- **Tipado Estricto**: Queda PROHIBIDO el uso de `any` en cualquier archivo TypeScript del
  proyecto. Toda entrada externa DEBE validarse y transformarse obligatoriamente mediante
  `class-validator` y `class-transformer` a través de `ValidationPipe` global.
- **Transaccionalidad y Consistencia Local**: Al autenticar (`POST /v1/auth/login`) o registrar
  (`POST /v1/auth/registro`) un usuario contra `RENDER_AUTH_API_URL`, el sistema DEBE garantizar
  la persistencia sincronizada en `ASISCONEXION_DB` (`UserAccount`, su perfil `Actor` 1:1 y
  `DeviceSession`) antes de emitir el `device_token` local. Queda PROHIBIDO emitir sesiones
  locales para usuarios registrados que no hayan sido persistidos en `ASISCONEXION_DB`.
- **Manejo de Errores Homologado (RFC 7807)**: Todos los errores HTTP DEBEN serializarse
  mediante `ExceptionFilters` globales siguiendo el estándar **RFC 7807 (Problem Details for
  HTTP APIs)**. Los errores del servicio externo (`{ error }`), caídas de red o límites de tasa
  (429) DEBEN traducirse limpiamente a `UnauthorizedException` (401), `ConflictException` (409)
  o `BadGatewayException` (502) según corresponda.
- **Rendimiento para Gama de Entrada (RT-01)**: Todo endpoint de listado DEBE exigir y aplicar
  paginación obligatoria y devolver payloads JSON ligeros (incluyendo solo URLs para contenido
  multimedia) para garantizar fluidez en dispositivos móviles básicos y versión Web.

## Seguridad, Moderación y Cumplimiento Legal en Colombia

- **Moderación en Dos Capas (Filtro Automático + Revisión Humana RN-02)**:
  1. **Filtro Automático Previo**: Toda entidad `Post` y `Comment` (tanto de usuarios
     registrados como de sesiones anónimas) DEBE pasar por `ContentFilterService` al crearse.
     Si infringe alguna regla (groserías, enlaces externos, datos de menores o spam), DEBE
     persistirse inmediatamente con `status = 'REJECTED'` y `rejection_reason = 'AUTO_FILTER'`.
  2. **Revisión Humana Obligatoria (RN-02)**: Si supera el filtro automático, DEBE crearse de
     forma estricta e incondicional con `status = 'PENDING'`. Los endpoints públicos de lectura
     y feed SOLO DEBEN exponer registros cuyo estado sea `status = 'APPROVED'`.
  3. **Restricciones para Anónimos**: Las sesiones anónimas NO poseen perfil `Actor`, pueden
     reaccionar sin restricción, pero están sujetas a límites diarios configurables de creación
     de publicaciones y comentarios por dispositivo además de la moderación en dos capas.
- **Roles de Administración y Moderación (`ADMIN` y `MODERATOR`)**:
  - Todo usuario cuyos `external_roles` en el servicio central incluyan `'ADMIN'` posee
    automáticamente privilegios de administrador en AsisConexión.
  - Los administradores (`ADMIN`) pueden asignar o revocar el rol global local
    `local_role = 'MODERATOR'` a usuarios registrados.
  - Tanto `ADMIN` como `MODERATOR` pueden consultar la cola de moderación y aprobar o rechazar
    publicaciones y comentarios (`rejection_reason = 'HUMAN'`), pero `MODERATOR` NO posee
    privilegios administrativos sobre usuarios ni asignación de roles.
- **Protección de Datos Personales y de Menores (Ley 1581 de 2012 y Ley 1098 de 2006)**: El
  sistema DEBE validar y persistir obligatoriamente la marca de tiempo `consent_accepted_at`
  al crear una sesión de usuario (`DeviceSession`) o al referenciar URLs multimedia asociadas
  a publicaciones. Ninguna operación sujeta a consentimiento legal puede completarse con
  `consent_accepted_at` nulo o ausente.

## Gobernanza

- **Supremacía Normativa**: Esta Constitución prevalece sobre cualquier práctica ad-hoc,
  decisión local de implementación o plantilla genérica dentro de AsisConexión Backend.
- **Puertas de Revisión (Constitution Check)**: Toda especificación (`spec.md`), plan de
  implementación (`plan.md`), desglose de tareas (`tasks.md`) y Pull Request DEBE verificar
  explícitamente: (1) contratos `@nestjs/swagger` previos al código, (2) separación SRP/SOLID
  con inyección por tokens (`IExternalAuthAdapter`, `IAssistantEngineProvider`, `IContentRule`)
  y DTOs segregados sin `clave`, (3) ausencia total de `any`, (4) persistencia única en
  `ASISCONEXION_DB` coordinada por HTTP con `RENDER_AUTH_API_URL` y errores RFC 7807, (5)
  paginación RT-01 y multimedia por URLs, (6) moderación en dos capas (`AUTO_FILTER` + humana
  RN-02 con roles `ADMIN`/`MODERATOR`) y (7) trazabilidad de `consent_accepted_at` conforme a
  Ley 1581 de 2012 y Ley 1098 de 2006.
- **Procedimiento de Enmienda**: Cualquier cambio a esta Constitución DEBE tramitarse mediante
  `/speckit-constitution`, registrando el reporte de impacto de sincronización, actualizando
  las plantillas dependientes en `.specify/templates/` y definiendo el plan de migración si
  afecta módulos existentes.
- **Política de Versionado Semántico (`MAJOR.MINOR.PATCH`)**:
  - **MAJOR**: Eliminación o redefinición incompatible de principios arquitectónicos, SOLID o
    de cumplimiento normativo/legal.
  - **MINOR**: Incorporación de un nuevo principio o expansión material de reglas obligatorias.
  - **PATCH**: Ajustes de redacción, precisión terminológica o correcciones sin impacto
    semántico en las obligaciones del equipo.
- **Guía de Desarrollo en Ejecución**: Los desarrolladores y agentes de IA DEBEN consultar
  `AGENTS.md` y el plan activo en `specs/` para el contexto operativo de cada iteración.

**Version**: 2.0.0 | **Ratified**: 2026-10-25 | **Last Amended**: 2026-10-27
