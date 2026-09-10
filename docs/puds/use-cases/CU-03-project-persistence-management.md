# CU-03 - Persistencia y gestion de proyectos

## Objetivo

Persistir proyectos UML canonicos, exponer su ciclo de vida REST y gestionarlos desde la aplicacion con CAS por `storageVersion`.

## Implementacion realizada

- Prisma 6, esquema PostgreSQL, migracion inicial y `compose.yaml`. La aplicacion usa `DATABASE_URL`; las integraciones usan `TEST_DATABASE_URL` contra `localhost:5432/examen_sw1_test`.
- Decoder estructural framework-independent en `uml-core`, seguido por el unico validador semantico `validateProjectDocument()`.
- Envelope `ProjectResource`, mapper Prisma y API NestJS/Fastify `POST/GET/PUT/PATCH/DELETE /projects`, con errores filtrados, limite de 1 MiB y CAS atomico.
- Landing Material para listar, crear, abrir, renombrar y eliminar; `/editor?projectId=<uuid>` usa sesiones nuevas, historial nuevo, UUIDs de dominio, save manual, dirty/conflict/reload.
- Correcciones pre-browser: CORS Nest/Fastify declara origen configurado y `GET, POST, PUT, PATCH, DELETE, OPTIONS`, con regresion de preflight. El contenedor React Flow declara la cadena de dimensiones responsive sin modificar el dominio ni `DiagramLayout`; `LOCAL DEMO` solo se muestra para la sesion temporal no persistida.
- Correccion de estabilidad del canvas: la espera anterior por dimensiones hacia polling con `requestAnimationFrame` y encolaba readiness repetido desde `ResizeObserver`. `UmlCanvas` mide unicamente cambios reales, deriva readiness de dimensiones positivas y espera `onInit` antes de `fitView`; esta ruta no escribe `ProjectDocument`, `DiagramLayout`, sesion ni dirty state.
- Correccion focalizada de relaciones: el edge custom usa un smooth-step ortogonal con lado de entrada/salida inferido por la geometria. El dialogo y el inspector usan selects accesibles de presets UML (`0..1`, `1`, `0..*`, `1..*`) sin multiplicidades implícitas. El inspector permite editar o limpiar el nombre y guardar nombre/multiplicidades en un único `UpdateRelationship` canónico e historizable; las generalizaciones no ofrecen ni proyectan multiplicidades.

## Decisiones tecnicas

- `ProjectDocument.revision`, `storageVersion` y `documentSchemaVersion` son distintos; solo `storageVersion` controla concurrencia persistente.
- El envelope se guarda en columnas relacionales; `model` y `layout` se guardan como JSONB sin React Flow, historial ni estado transitorio de UI.
- Un conflicto conserva el trabajo local. No existen autosave, merge ni force overwrite.

## Componentes principales

- `backend/prisma/schema.prisma`, `backend/prisma/migrations/`, `backend/src/persistence/` y `backend/src/projects/`.
- `packages/uml-core/src/`.
- `frontend/lib/projects/project-api.ts`, `frontend/components/projects/ProjectLandingClient.tsx`, `frontend/components/editor/UmlEditorClient.tsx` y `frontend/stores/editor-store.ts`.

## Pruebas automatizadas

Verificacion final ejecutada el 2026-09-08:

- UML core: `npm run test --workspace @examen-sw1/uml-core` PASS, 35 tests; typecheck, lint y build PASS.
- Backend: `db:generate`, `db:validate` y `db:migrate:test` PASS; `test:integration` PASS, 6 pruebas PostgreSQL reales; `test` PASS, 9 tests; typecheck, lint y build PASS.
- Frontend: `test` PASS, 51 tests; typecheck, lint y build PASS.
- Raiz: `npm run test` PASS, 95 tests; typecheck, lint y build PASS.
- `openspec validate "cu-03-project-persistence-management" --strict` PASS; `openspec validate --specs --strict` PASS, 3 specs; `git diff --check` PASS, sin errores reportados.

Los logs backend incluyen dos mensajes esperados de `ProjectErrorFilter` para filas JSONB corruptas cubiertas por pruebas; los tests pasan.

Verificacion de correcciones el 2026-09-09:

- Backend focalizado: `npm run test --workspace backend -- health.controller.spec.ts` PASS, 2 tests, incluido `OPTIONS /projects` con origen y metodos permitidos.
- Frontend focalizado: `npm run test --workspace frontend -- UmlEditorClient.test.tsx` PASS, 31 tests, incluidos host dimensionado, observador `0 -> valido -> mismo tamano` sin mutacion de sesion/layout/dirty, rerender estable y badge ausente para sesion persistida.
- Raiz: `npm run test` PASS, 97 tests (52 frontend, 10 backend, 35 UML core); `npm run typecheck`, `npm run lint` y `npm run build` PASS.
- Checks posteriores a la correccion de estabilidad: `npm run test` PASS, 98 tests (53 frontend, 10 backend, 35 UML core); `npm run typecheck`, `npm run lint` y `npm run build` PASS.
- Checks posteriores a la correccion de relaciones: `npm run test` PASS, 108 tests (63 frontend, 10 backend, 35 UML core); `npm run typecheck`, `npm run lint` y `npm run build` PASS. `openspec validate "cu-03-project-persistence-management" --strict` PASS y `git diff --check` no reporto errores (solo warnings CRLF de Windows).
- Checks de UX focalizada de relaciones: `npm run test` PASS, 109 tests (63 frontend, 10 backend, 36 UML core); `npm run typecheck`, `npm run lint` y `npm run build` PASS. `openspec validate "cu-03-project-persistence-management" --strict` y `openspec validate --specs --strict` PASS; `git diff --check` sin errores de whitespace, con warnings CRLF de Windows.

## Navegador y responsive

Chrome esta instalado en `C:\Program Files\Google\Chrome\Application\chrome.exe`, pero el workspace no tiene `playwright` ni `@playwright/test`, no hay configuracion Playwright y este entorno no expone otra herramienta de automatizacion/interaccion de navegador. No se instalaron dependencias.

Real browser verification remains pending.

No se ejecuto el retest del flujo create/open/edit UML/move layout/manual save/reopen contra frontend, backend y PostgreSQL reales, ni la aceptacion responsive. Debe confirmar preflight CORS, ausencia de React Flow #004 y ausencia de `LOCAL DEMO` en sesion persistida. La tarea 4.3 permanece pendiente.

## Limitaciones y deuda tecnica

- Docker no esta disponible; PostgreSQL local aislado cubre las integraciones.
- `npm audit` mantiene 5 vulnerabilidades transitivas (2 moderadas, 3 altas); no se aplico una actualizacion mayor forzada.
- La aceptacion real en navegador y responsive bloquea el cierre de CU-03.

## Resultado actual

Final Verification parcial: 4.1, 4.2 y 4.4 completadas por evidencia. Las tareas 4.3 y 4.5 estan pendientes. No se archivo el cambio, no se creo commit y no se hizo push.
