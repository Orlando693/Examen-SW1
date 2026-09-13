# Project Status

## Estado general

CU-04 esta COMPLETADO, VERIFIED, MANUALLY ACCEPTED y ARCHIVED. CU-05 tiene Incremento 1 funcional, automatizado y manualmente aceptado; conserva 3 checkboxes mixtas (16/19) con dependencias de comandos/resource updates futuros. Incremento 2 tiene Tasks 2.1-2.13 completas; 2.12 incluye evidencia determinista de la carrera join/snapshot/applied con Socket.IO y PostgreSQL reales. Aceptacion manual durable realtime aportada por usuario: OWNER/EDITOR PASS para crear, renombrar, mover y agregar atributo sin Save ni F5; el diagnostico esperado para una clase en minusculas fue observado.

## Planificación vigente

- 4 ciclos PUDS.
- 12 casos de uso (`CU-00` a `CU-11`).
- 3 casos de uso por ciclo.
- Flutter reemplaza a Capacitor para la aplicación móvil generada.
- AWS es la plataforma obligatoria de despliegue online.

## Ciclo actual

Ciclo 2 — Elaboracion, usuarios y colaboracion.

## Caso de uso activo

CU-05 — Colaboracion realtime y presencia. Incrementos 1 y 2 implementation-complete. 1.8 queda completa; 1.6 y 1.13 permanecen abiertas exclusivamente por `resource updates` del Incremento 3. Incremento 2 Tasks 2.1-2.18 completas y documentadas. Incremento 3 NOT_STARTED.

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
- CU-05 Incremento 2 Task 2.1: decoder puro framework-independent para envelope realtime cerrado y las 19 variantes `UmlCommand`; valida UUID, versiones non-negative safe integers, enums, nested payloads, limites de string/coleccion, campos authority/UI y valores no finitos. No ejecuta comandos, normaliza, genera digest, persiste, hace CAS ni emite Socket.IO. Decoder 32 PASS, `uml-core` 36 PASS, backend typecheck/lint/build PASS.
- CU-05 Incremento 2 Task 2.2: serializacion canonical pura con claves ordenadas, arrays preservados, numeros finitos y sin `undefined`, mas SHA-256 hexadecimal para intent que incluye project/session/actor/bases/command y para `ProjectDocument` autoritativo. No normaliza IDs/defaults, ejecuta comandos, persiste ni emite. Digest/decoder 36 PASS, `uml-core` 36 PASS, backend typecheck/lint/build PASS.
- CU-05 Incremento 2 Task 2.3: `normalizeRealtimeCommand()` puro recibe el `ProjectResource` ya cargado, IDs server-selected y timestamp ISO caller-supplied. Materializa IDs opcionales de create/layout, defaults `private`/`association`, preserva comandos restantes, valida target/duplicados de ApplyLayout y conserva su orden. No llama executor/CommandBus, no persiste, no avanza versiones ni integra gateway. Foundation backend 58 PASS, `uml-core` 36 PASS, typecheck/lint/build PASS.
- CU-05 Incremento 2 Task 2.4: contratos puros `ProjectCommandApplied` y `AuthoritativeResourceSnapshot` derivan revision/storage/digest SHA-256 desde el recurso resultante sin avanzar contadores; realtime version, bases, actor, commandId y command normalizado son inputs autoritativos. Join/resync ahora incluyen resource completo y digest coincidente. No hay handler `project:command`, ejecucion, persistence/CAS, ACK ni broadcast. Foundation 60 PASS, integration realtime 15 PASS, `uml-core` 36 PASS, typecheck/lint/build PASS.
- CU-05 Incremento 2 Tasks 2.6-2.10: `ProjectCommandCoordinator` serializa la ruta durable tras revalidar token/usuario/acceso: decodifica, deduplica antes de stale, exige sesion/realtime/revision exactas, recarga PostgreSQL, normaliza, ejecuta exclusivamente mediante `UmlCommandBus`, valida semantica y persiste con CAS authorization-aware que retorna la fila exacta. Dedupe por epoch usa actor+digest, TTL/LRU bounded y devuelve `DUPLICATE`; CAS reintenta una sola vez para cambios metadata-only y en conflicto canonico invalida el epoch. El CAS retornado es el commit point; un hook post-CAS que falla envenena/invalida el epoch sin rollback y resync crea snapshot PostgreSQL nuevo. Backend 134 PASS, integration real PostgreSQL/Socket.IO 21 PASS, backend typecheck/lint/build PASS.
- CU-05 Incremento 2 Task 2.11: `project:command` devuelve el resultado durable al originador mediante ACK y emite `project:command-applied` solo a los otros sockets autorizados del room mediante el filtro de emision existente. `DUPLICATE` no reemite. Backend 135 PASS, integracion real PostgreSQL/Socket.IO 22 PASS, backend typecheck/lint/build PASS.
- CU-05 Incremento 2 Task 2.5: frontend define el envelope/ACK tipado de `project:command` compatible con backend y `RealtimeCommandGate`. Al activarse despues del join, el gate toma los metadatos actuales de `CollaborationSessionBridge`, genera un `commandId`, permite un solo envio pendiente y descarta ACKs de generaciones limpiadas por disconnect, switch o unmount. Las 19 variantes UML del store (toolbox, inspector, relacion, drag y auto-layout) pasan por el gate durante realtime; sin gate mantienen el modo local con historial. Ningun envio, ACK aplicado, `DUPLICATE` o error muta documento canonico, historial, revision, storageVersion ni snapshot: ingestion/replay/resync queda expresamente para Task 2.12+. Frontend tests 141 PASS; typecheck PASS.
- CU-05 Incremento 2 Task 2.12: `AuthoritativeCommandIngestionController` mantiene baseline explicita de generation/project/session/realtime/revision/storage/resource, serializa ingestion asincrona y reproduce solo comandos normalizados mediante `UmlCommandBus` sobre un candidato. Verifica revision y SHA-256 canonical Web Crypto antes de publicar metadata; clasifica `NEXT`, `OLD`, `GAP`, `DIFFERENT_SESSION`, `STALE_GENERATION` y `MISMATCH`, limita IDs/buffer a 128 y solicita recovery una vez por baseline. `CollaborationSessionBridge` instala join/resync solo tras validar la baseline y pasa ACK propio y broadcasts por el mismo controller; el store recibe el recurso autoritativo en una unica accion y recovery se coalesce una vez. El harness real Nest/Fastify/Socket.IO/PostgreSQL usa `CollaborationClient` y bridge reales con un wrapper de prueba que retiene solo la resolucion del join ACK: listener activo, snapshot v0 capturado, command v1 generado por otro socket y recibido durante la barrera, sin instalacion previa; al liberar, instala snapshot primero y reproduce el evento una sola vez con revision/storage/realtime/digest exactos. La regresion frontend tambien ignora un duplicate ya incluido en el snapshot. Backend realtime 23 PASS; frontend 151 PASS; raiz 323 PASS; typecheck/lint/build de ambos workspaces y raiz PASS.
- CU-05 Incremento 2 Task 2.13: `RealtimeCommandGate` arma un timer por comando/generacion. Al vencer no aplica intencion local, conserva el unico comando incierto y solicita solamente `CollaborationSessionBridge.recover()`. El bridge coalesce la recuperacion y solo libera el gate cuando instala el snapshot autoritativo; no existe retry automatico ni `commandId` nuevo. Un ACK tardio recibido durante recovery pasa por la ingestion autoritativa, pero no libera el bloqueo antes del snapshot; uno posterior se descarta porque el snapshot ya es la autoridad. `clear`, disconnect, switch y unmount cancelan el timer y descartan callbacks de generaciones viejas. Root tests 326 PASS (frontend 154, backend 136, core 36); typecheck/lint raiz PASS; build frontend PASS.
- CU-05 Incremento 2 Task 2.14: toda instalacion autoritativa central del store (join, ACK propio, broadcast remoto y resync) recrea `UmlHistory` con el documento autoritativo y stacks vacios. La salida de una colaboracion que llego a unirse tambien rebasa el documento actual antes de volver al modo local. Undo/Redo y `Ctrl/Cmd+Z`/`Ctrl/Cmd+Shift+Z` se mantienen para historial local, pero los controles y atajos se bloquean mientras existe la compuerta realtime. Frontend 156 PASS; typecheck, lint y build frontend PASS; OpenSpec strict PASS.
- CU-05 Incremento 2 Task 2.15: el drag de React Flow solo publica presencia de actividad al iniciar y mantiene cursor en el canal de presencia; no cambia el documento canonico en frames. Al terminar, pasa una unica posicion flow-space por `MoveNode` y el gate realtime, sin optimismo. Auto-layout calcula una unica intencion `ApplyLayout` originada por ELK y la envia por el mismo gate, sin `MoveNode` ni mutacion local previa al ACK. La instalacion autoritativa remota ya no ejecuta `fitView` ni produce feedback; el modo local conserva su `MoveNode`, historial y comportamiento de auto-layout. Frontend 159 PASS; typecheck, lint, build y OpenSpec strict PASS; `git diff --check` PASS con warnings LF/CRLF conocidos.
- CU-05 Incremento 2 Tasks 2.16-2.18: integracion Nest/Fastify/Socket.IO/PostgreSQL real cubre las 19 variantes `UmlCommand`, propagacion OWNER/EDITOR, convergencia modelo/layout/digest, diagnostico semantico, edit sobre eliminado y conflictos rename/delete, same-field y same-base. Cubre tambien dominios separados de `revision`, `storageVersion`, `realtimeVersion`, `sessionId` y `documentSchemaVersion` para command, duplicate, rejection, resync y presence; el hook posterior al CAS demuestra que PostgreSQL ya contiene revision/storage antes de `APPLIED`, y el resync tras reemplazo de epoch recupera el recurso durable y rechaza la sesion vieja. El test de manager con fake clock prueba que rejoin cancela eviction y un timer viejo no elimina un epoch nuevo. Backend focalizado: 28 PASS; typecheck/lint PASS.
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

Iniciar Incremento 3 solo tras la siguiente instruccion/aprobacion; no archivar CU-05 todavia.
