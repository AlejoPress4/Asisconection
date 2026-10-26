<!--
Sync Impact Report
- Version change: N/A (unpopulated template) → 1.0.0
- Modified principles:
  - [PRINCIPLE_1_NAME] → I. Identidad Arquitectónica: Monolito Modular y SDD OpenAPI-First
  - [PRINCIPLE_2_NAME] → II. Persistencia Dual Activa e Integración con API Central
  - [PRINCIPLE_3_NAME] → III. Responsabilidad Única por Capa (SOLID — SRP)
  - [PRINCIPLE_4_NAME] → IV. Extensibilidad Abierta/Cerrada en Asistencia Inteligente (SOLID — OCP)
  - [PRINCIPLE_5_NAME] → V. Sustitución, Segregación de Contratos e Inversión de Dependencias (SOLID — LSP, ISP, DIP)
- Added sections:
  - Reglas de Clean Code, Calidad y Rendimiento (replaces [SECTION_2_NAME])
  - Seguridad, Moderación y Cumplimiento Legal en Colombia (replaces [SECTION_3_NAME])
  - Gobernanza (replaces Governance placeholders)
- Removed sections:
  - None
- Templates requiring updates:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ✅ updated: .specify/templates/tasks-template.md
  - ✅ updated: AGENTS.md
  - ✅ verified (no changes needed): .specify/templates/checklist-template.md
  - ✅ verified (no agent-specific references): .agents/skills/speckit-*/SKILL.md
- Follow-up TODOs:
  - None
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

### II. Persistencia Dual Activa e Integración con API Central

- El backend DEBE operar de forma simultánea y coordinada sobre dos bases de datos PostgreSQL
  y una API externa de autenticación:
  1. **API Central en Render (`RENDER_AUTH_API_URL`)**: Consumo HTTP activo mediante
     `@nestjs/axios` del servicio general de autenticación fundacional (ej.
     `POST ${RENDER_AUTH_API_URL}/auth/registro`).
  2. **Base de Datos General (`FOUNDATION_GLOBAL_DB`)**: Conexión PostgreSQL activa dedicada
     exclusivamente a lectura y verificación cruzada de los usuarios registrados a nivel
     fundacional.
  3. **Base de Datos Propia (`ASISCONEXION_DB`)**: Conexión PostgreSQL principal donde DEBEN
     persistir sincronizados los usuarios (`UserAccount`), las sesiones de dispositivos
     (`DeviceSession`) y todas las entidades de red social (`Category`, `Post`, `Comment`,
     `Reaction`), directorio (`RedirectionLink`) y chatbot (`FaqKnowledge`).

**Justificación**: Combina la fuente única de identidad fundacional con autonomía operativa y
persistencia dedicada para las capacidades sociales, de directorio y de asistencia propias de
AsisConexión.

### III. Responsabilidad Única por Capa (SOLID — SRP)

- Cada capa técnica DEBE cumplir una única responsabilidad sin invadir responsabilidades
  vecinas:
  - **Controladores (`*.controller.ts`)**: Solo DEBEN gestionar enrutamiento HTTP, códigos de
    estado, validación declarativa de DTOs y decoradores `@nestjs/swagger`. Queda PROHIBIDO
    incluir reglas de negocio o acceso a datos en controladores.
  - **Servicios de Dominio (`*.service.ts`)**: DEBEN orquestar las reglas de negocio (ej.
    sincronizar usuario entre Render/`FOUNDATION_GLOBAL_DB` y `ASISCONEXION_DB`, o imponer
    `status = 'PENDING'` al crear publicaciones y comentarios).
  - **Adaptadores Externos (`*.adapter.ts`)**: DEBEN aislar por completo las llamadas HTTP
    hacia `RENDER_AUTH_API_URL` y la traducción de sus respuestas o fallos de red.
  - **Repositorios (`*.repository.ts`)**: DEBEN aislar las operaciones TypeORM dirigidas a
    `ASISCONEXION_DB` y `FOUNDATION_GLOBAL_DB`.

**Justificación**: El aislamiento estricto entre transporte, negocio, red externa y TypeORM
reduce el acoplamiento accidental y permite probar cada capa de forma independiente.

### IV. Extensibilidad Abierta/Cerrada en Asistencia Inteligente (SOLID — OCP)

- El módulo `AssistantModule` DEBE operar en Fase 1 mediante un motor determinista de preguntas
  frecuentes (`FaqRuleEngineProvider`) expuesto a través de la abstracción
  `IAssistantEngineProvider`.
- El diseño DEBE permanecer abierto a la extensión para inyectar en Fase 2 el proveedor
  `RagMultimodalProvider` (`pgvector` + LLM) mediante configuración del contenedor de NestJS,
  y cerrado a la modificación de los controladores y contratos HTTP existentes.

**Justificación**: Permite entregar valor inmediato en Fase 1 con baja latencia y evolucionar
a capacidades RAG multimodales en Fase 2 sin romper clientes móviles ni Web.

### V. Sustitución, Segregación de Contratos e Inversión de Dependencias (SOLID — LSP, ISP, DIP)

- **Liskov Substitution Principle (LSP)**: Los adaptadores de conexión a Render
  (`IRenderAuthClient` / `IExternalAuthAdapter`) y los repositorios de `ASISCONEXION_DB` y
  `FOUNDATION_GLOBAL_DB` DEBEN poder sustituirse limpiamente por `Mocks` durante el desarrollo
  paralelo con Frontend sin alterar los contratos JSON ni la semántica esperada.
- **Interface Segregation Principle (ISP)**: Se DEBEN separar estrictamente los DTOs públicos
  de entrada/salida, los payloads enviados hacia Render (`username`, `email`, `clave`, `rol`)
  y las estructuras internas de moderación. Queda terminantemente PROHIBIDO exponer el campo
  `clave` o tokens internos en respuestas públicas o logs.
- **Dependency Inversion Principle (DIP)**: Los servicios de alto nivel DEBEN depender
  exclusivamente de interfaces (`IExternalAuthAdapter`, `IRenderAuthClient`,
  `IUserSyncRepository`, `IAssistantEngineProvider`) inyectadas mediante tokens explícitos de
  NestJS, nunca de implementaciones concretas.

**Justificación**: Protege credenciales sensibles por diseño, desacopla el núcleo de negocio
respecto a fallos o latencias externas y acelera la integración continua con Frontend mediante
dobles de prueba intercambiables.

## Reglas de Clean Code, Calidad y Rendimiento

- **Tipado Estricto**: Queda PROHIBIDO el uso de `any` en cualquier archivo TypeScript del
  proyecto. Toda entrada externa DEBE validarse y transformarse obligatoriamente mediante
  `class-validator` y `class-transformer` a través de `ValidationPipe` global.
- **Transaccionalidad y Consistencia Eventual**: Al registrar un usuario contra
  `POST ${RENDER_AUTH_API_URL}/auth/registro`, el sistema DEBE garantizar su persistencia
  sincronizada en `ASISCONEXION_DB` (`UserAccount` y contexto asociado) antes de emitir el
  token de sesión local. Queda PROHIBIDO emitir sesiones locales para usuarios no persistidos
  en `ASISCONEXION_DB`.
- **Manejo de Errores Homologado (RFC 7807)**: Todos los errores HTTP DEBEN serializarse
  mediante `ExceptionFilters` globales siguiendo el estándar **RFC 7807 (Problem Details for
  HTTP APIs)**. Cuando el servicio de Render falle por red/indisponibilidad o rechace un
  registro por conflicto, el sistema DEBE mapear el fallo limpiamente a `BadGatewayException`
  (502) o `ConflictException` (409), respectivamente.
- **Rendimiento para Gama de Entrada (RT-01)**: Todo endpoint de listado DEBE exigir y aplicar
  paginación obligatoria y devolver payloads JSON ligeros (seleccionando solo los campos
  requeridos por vista) para garantizar fluidez en dispositivos móviles básicos y versión Web.

## Seguridad, Moderación y Cumplimiento Legal en Colombia

- **Moderación Humana Obligatoria (RN-02)**: Toda entidad `Post` y `Comment` DEBE crearse de
  forma estricta e incondicional con `status = 'PENDING'`. Los endpoints públicos de lectura y
  feed SOLO DEBEN exponer registros cuyo estado sea `status = 'APPROVED'`.
- **Protección de Datos Personales y de Menores (Ley 1581 de 2012 y Ley 1098 de 2006)**: El
  sistema DEBE validar y persistir obligatoriamente la marca de tiempo `consent_accepted_at`
  al crear una sesión de usuario (`DeviceSession`) o al subir imágenes y contenidos asociados
  a menores de edad o beneficiarios. Ninguna operación sujeta a consentimiento legal puede
  completarse con `consent_accepted_at` nulo o ausente.

## Gobernanza

- **Supremacía Normativa**: Esta Constitución prevalece sobre cualquier práctica ad-hoc,
  decisión local de implementación o plantilla genérica dentro de AsisConexión Backend.
- **Puertas de Revisión (Constitution Check)**: Toda especificación (`spec.md`), plan de
  implementación (`plan.md`), desglose de tareas (`tasks.md`) y Pull Request DEBE verificar
  explícitamente: (1) contratos `@nestjs/swagger` previos al código, (2) separación SRP/SOLID
  con inyección por tokens y DTOs segregados sin `clave`, (3) ausencia total de `any`, (4)
  consistencia dual `FOUNDATION_GLOBAL_DB` / `ASISCONEXION_DB` + `RENDER_AUTH_API_URL` con
  errores RFC 7807, (5) paginación RT-01, (6) moderación RN-02 (`PENDING` / `APPROVED`) y (7)
  trazabilidad de `consent_accepted_at` conforme a Ley 1581 de 2012 y Ley 1098 de 2006.
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

**Version**: 1.0.0 | **Ratified**: 2026-10-25 | **Last Amended**: 2026-10-25
