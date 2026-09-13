# Project Status

## Estado general

CU-04 esta COMPLETADO, VERIFIED, MANUALLY ACCEPTED y ARCHIVED. CU-05 tiene Incremento 1 funcional, automatizado y manualmente aceptado; conserva 3 checkboxes mixtas (16/19) con dependencias de comandos/resource updates futuros. Incremento 2 esta READY TO START; no existe aun sincronizacion realtime durable de comandos UML.

## Planificación vigente

- 4 ciclos PUDS.
- 12 casos de uso (`CU-00` a `CU-11`).
- 3 casos de uso por ciclo.
- Flutter reemplaza a Capacitor para la aplicación móvil generada.
- AWS es la plataforma obligatoria de despliegue online.

## Ciclo actual

Ciclo 2 — Elaboracion, usuarios y colaboracion.

## Caso de uso activo

CU-05 — Colaboracion realtime y presencia. Incremento 1 FUNCTIONAL SCOPE COMPLETE, automated validation PASS y manual browser acceptance PASS. El conteo permanece 16/19: 1.6 incluye matriz command/CAS de Incremento 2 y resource updates de Incremento 3; 1.8 incluye commandId dedupe de Incremento 2; 1.13 incluye broadcasts command/resource de Incrementos 2/3. Incremento 2 READY TO START; Incremento 3 NOT_STARTED.

## Casos de uso completados

- CU-00 — Base del proyecto. COMPLETADO. OpenSpec archivado como `openspec/changes/archive/2026-09-04-cu-00-project-foundation`.
- CU-01 — Nucleo UML canonico. COMPLETADO. OpenSpec archivado como `openspec/changes/archive/2026-09-05-cu-01-canonical-uml-core`. Commit `69d1a3b` pusheado.
- CU-02 — Workspace/editor UML manual. COMPLETADO, verificado, aceptado, archivado, commiteado y pusheado. OpenSpec archivado como `openspec/changes/archive/2026-09-07-cu-02-manual-uml-workspace`. Commit `67e5dee` pusheado.
- CU-03 — Persistencia y gestion de proyectos. COMPLETADO y archivado.
- CU-04 — Autenticacion, ownership e invitaciones. COMPLETADO, VERIFIED, MANUALLY ACCEPTED y ARCHIVED como `openspec/changes/archive/2026-09-12-cu-04-auth-ownership-invitations`.

## OpenSpec activo

`cu-05-realtime-collaboration-presence` en `openspec/changes/cu-05-realtime-collaboration-presence`.

## Problemas abiertos

- `npm audit` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas) despues de agregar Prisma. No se ejecutó `npm audit fix --force` para evitar cambios mayores no aprobados.
- Docker no esta instalado/disponible (`docker` no se reconoce); no bloquea el Incremento 1 porque la migracion y la integracion usan PostgreSQL local aislado.
- Deuda menor: `favicon.ico` devuelve 404. No bloquea CU-02.
- Deuda tecnica/accessibility: Chrome muestra `Blocked aria-hidden on an element because its descendant retained focus` relacionado con focus al usar Drawer MUI. No impidio el funcionamiento validado.
- Warnings LF/CRLF de Windows aparecen en `git diff --check`; no son errores de whitespace y no bloquean el cierre.

## Verificación actual

- CU-04 final verification: root `npm run test` PASS, 133 tests (backend 24, frontend 73, UML core 36); typecheck/lint/build PASS.
- Prisma generate/validate and `npm run db:migrate:test --workspace backend` PASS against `examen_sw1_test`.
- Cadena limpia de cinco migraciones PASS en PostgreSQL temporal; `_prisma_migrations` verificó cinco filas exactas, finalizadas y sin rollback; DB temporal eliminada.
- Chrome manual CU-04 PASS: owner create/open/edit/save/rename/reopen/invite/revoke; editor accept/open/edit/save y denegaciones administrativas; unrelated concealed; fragment, login continuation, mismatch y reject PASS; sin errores bloqueantes de consola.
- OpenSpec strict y `git diff --check` PASS.
- CU-05 Incremento 1: backend `npm test` PASS, 68 tests, con PostgreSQL real y Socket.IO serializado; frontend `npm test` PASS, 116 tests; typecheck/lint/build de ambos workspaces PASS; `openspec validate cu-05-realtime-collaboration-presence --strict` PASS. La cobertura real verifica OWNER/EDITOR, epoch de joins concurrentes, cambio de proyecto, expiracion, Presence de cursor/seleccion/edicion/actividad, aislamiento de room y limpieza offline. El join buffer y overflow/resync se verifican deterministamente en el bridge frontend.
- Aceptacion manual multi-profile CU-05 PASS: OWNER y EDITOR confirmaron roster, cursores remotos bidireccionales, seleccion de nodo tras pan/zoom, seleccion de relationship, editing, dragging Presence, hidden-tab cleanup, disconnect/reconnect sin duplicados y consolas limpias. La seleccion remota no cambia la seleccion local ni mueve el viewport. Las mutaciones UML realtime siguen siendo comportamiento esperado pre-Incremento 2: Save y reload/F5 siguen siendo necesarios para observar persistencia.
- CU-04 entrego User/Auth foundation, Argon2id, JWT Bearer con acceso de 60 minutos, autenticacion en `sessionStorage`, ownership de proyectos, autorizacion OWNER/EDITOR, ocultamiento IDOR, CAS `storageVersion` consciente de autorizacion, `ProjectMembership`, lifecycle seguro de `ProjectInvitation`, accept/reject/revoke, tokens de invitacion ligados al email con expiracion de siete dias y persistidos solo como hash, UI de invitaciones del owner y continuacion por login/register.
- Realtime collaboration no pertenece a CU-04: colaboradores ven cambios persistidos despues de Manual Save. CU-05 sera responsable de Socket.IO, sincronizacion realtime, presence y flujo colaborativo autoritativo de comandos.

- `npm run test --workspace @examen-sw1/uml-core`: verde, 30 tests.
- `npm run typecheck --workspace @examen-sw1/uml-core`: verde.
- `npm run lint --workspace @examen-sw1/uml-core`: verde.
- `npm run build --workspace @examen-sw1/uml-core`: verde.
- `npm run test --workspace frontend`: verde, 43 tests.
- `npm run typecheck --workspace frontend`: verde.
- `npm run lint --workspace frontend`: verde.
- `npm run build --workspace frontend`: verde.
- `npm run test`: verde, 74 tests totales.
- `npm run typecheck`: verde.
- `npm run lint`: verde.
- `npm run build`: verde.
- `openspec validate "cu-02-manual-uml-workspace" --strict`: verde.
- `openspec instructions apply --change "cu-02-manual-uml-workspace" --json`: 129/129 tasks completas tras aceptacion manual.
- `openspec status --change "cu-02-manual-uml-workspace"`: 4/4 artifacts completos.
- `openspec validate --specs --strict`: verde, 3 specs.
- `openspec list --json`: sin cambios activos tras archive.
- `openspec doctor`: verde.
- `git diff --check`: sin errores; solo warnings LF/CRLF de Windows.
- Runtime local `/editor`: `GET /editor` devolvio `200` con HTML de Next.js en puerto temporal `3002`; no verifica consola del navegador.
- `npm run db:generate --workspace backend`: verde con Prisma Client `6.19.3`.
- `npm run db:validate --workspace backend`: verde.
- `npm run test --workspace @examen-sw1/uml-core`: verde, 35 tests.
- `npm run typecheck --workspace @examen-sw1/uml-core`: verde.
- `npm run lint --workspace @examen-sw1/uml-core`: verde.
- `npm run build --workspace @examen-sw1/uml-core`: verde.
- `npm run db:migrate:test --workspace backend`: verde; migracion inicial aplicada y luego sin migraciones pendientes en `examen_sw1_test`.
- `npm run test:integration --workspace backend`: verde, 1 prueba PostgreSQL real, sin skip.
- `npm run test --workspace backend`: verde, 4 tests; integracion PostgreSQL activa.
- `npm run typecheck --workspace backend`: verde.
- `npm run lint --workspace backend`: verde.
- `npm run build --workspace backend`: verde.
- `npm run test:integration --workspace backend`: verde, 6 tests PostgreSQL (round-trip y lifecycle/CAS).
- `npm run test`: verde, 87 tests totales.
- `npm run typecheck`, `npm run lint`, `npm run build`: verdes tras Incremento 2.
- `npm run test --workspace frontend`: verde, 51 tests.
- `npm run test`: verde, 95 tests totales.
- `npm run typecheck`: verde.
- `npm run lint`: verde.
- `npm run build`: verde.
- Final Verification 2026-09-08: UML core PASS, 35 tests; typecheck/lint/build PASS.
- Final Verification 2026-09-08: Prisma generate/validate/migracion aislada PASS; 6 pruebas de integracion PostgreSQL backend PASS; backend test PASS, 9 tests; typecheck/lint/build backend PASS.
- Final Verification 2026-09-08: frontend test PASS, 51 tests; typecheck/lint/build frontend PASS. Root test PASS, 95 tests; root typecheck/lint/build PASS.
- `openspec validate "cu-03-project-persistence-management" --strict` y `openspec validate --specs --strict` PASS; este ultimo valido 3 specs. `git diff --check` no reporto errores.
- Chrome esta instalado, pero no existen `playwright` ni `@playwright/test` en el workspace, ni configuracion Playwright ni herramienta alternativa de interaccion de navegador en este entorno. No se instalo tooling. Real browser verification remains pending.
- Correcciones 2026-09-09: test focalizado CORS backend PASS (2 tests, incluido preflight); test focalizado `UmlEditorClient` PASS (30 tests, incluido host dimensionado y ausencia de `LOCAL DEMO` en sesion persistida). Root `npm run test` PASS (97 tests: frontend 52, backend 10, UML core 35); root `npm run typecheck`, `npm run lint` y `npm run build` PASS. `git diff --check` PASS sin errores de whitespace, con warnings LF/CRLF de Windows.
- Correccion de relaciones CU-03 pendiente de retest real: se identifico que la composicion flex/grid del host de React Flow podia carecer de dimensiones efectivas tras integrar la sesion persistida, a diferencia del flujo CU-02 en memoria. El host ahora conserva dimensiones completas sin alterar modelo, historial, Command Bus ni proyeccion. Las pruebas de componente cubren asociacion, agregacion, composicion y generalizacion en sesion persistida: UUID, extremos, documento, edge proyectado, reset de draft, ausencia de duplicado, Undo/Redo, dirty y save manual. La aceptacion en navegador real aun no se ha ejecutado.
- Correccion de estabilidad de canvas 2026-09-09: el readiness anterior hacia polling por `requestAnimationFrame` mientras el host era `0x0` y encolaba actualizaciones locales para cada callback de `ResizeObserver`, incluido readiness ya verdadero. El montaje controlado de React Flow podia volver a notificar dimensiones y formar un ciclo de actualizaciones de presentacion en Chrome. `UmlCanvas` ahora mide de forma idempotente, deriva readiness solo de dimensiones positivas, no hace polling y espera `onInit` antes del `fitView`; no cambia `ProjectDocument`, `DiagramLayout`, sesion ni dirty state. Prueba focalizada cubre observador `0 -> valido -> mismo tamano` y rerender sin mutacion del store. Real browser verification remains pending.
- Checks posteriores a la correccion de estabilidad: `npm run test` PASS (98 tests: frontend 53, backend 10, UML core 35); `npm run typecheck`, `npm run lint` y `npm run build` PASS.
- Correccion focalizada de relaciones 2026-09-09: el edge custom ahora usa `getSmoothStepPath` ortogonal y una heuristica por eje dominante para sus lados; no cambia ciclo de vida del canvas, backend, persistencia ni Command Bus. El dialogo crea relaciones con nombre y multiplicidades opcionales validadas, sin `1`/`0..*` implicitos; el inspector actualiza las existentes por `UpdateMultiplicity` e historial. La proyeccion oculta multiplicidades de generalizacion. Frontend cubre lados, labels, dialogo, undo e inspector; raiz `npm run test` PASS (108: frontend 63, backend 10, UML core 35), typecheck/lint/build PASS, OpenSpec estricto PASS y `git diff --check` sin errores (warnings CRLF de Windows). La aceptacion real de navegador permanece pendiente.
- UX focalizada de relaciones 2026-09-09: dialogo e inspector reemplazan limites manuales por selects accesibles de presets UML opcionales (`0..1`, `1`, `0..*`, `1..*`) y no asignan defaults. El inspector permite editar/limpiar nombre y aplicar nombre y ambas multiplicidades mediante un unico `UpdateRelationship` canonico, Command Bus e historial; generalizacion solo conserva nombre. No cambia routing, canvas lifecycle, backend ni persistencia. Pruebas cubren create, clear, Undo/Redo, dirty, Save y `storageVersion`; raiz `npm run test` PASS (109: frontend 63, backend 10, UML core 36), typecheck/lint/build y ambas validaciones OpenSpec estrictas PASS. `git diff --check` no reporta errores (warnings CRLF de Windows). La aceptacion real de navegador permanece pendiente.

## Próxima acción

Iniciar el primer micro-pass de Incremento 2 de `cu-05-realtime-collaboration-presence`: decoder estricto framework-independent del command envelope y los 19 comandos UML; no implementar aun persistencia/CAS, Command Bus realtime ni frontend durable mutation pipeline.
