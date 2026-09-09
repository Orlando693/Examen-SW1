# Project Handoff

## Estado actual

CU-00, CU-01 y CU-02 cerrados. CU-02 fue verificado, aceptado, archivado en `openspec/changes/archive/2026-09-07-cu-02-manual-uml-workspace`, commiteado como `67e5dee feat: complete CU-02 manual UML workspace` y pusheado. La verificacion manual real final en Chrome responsive confirmo Ctrl+F5 sin hydration mismatch, sin React Flow #004, sin `Maximum update depth exceeded`, responsive mobile funcional, Model Rail/Inspector mediante composicion compacta, creacion/seleccion/renombrado de clase desde responsive y canvas usable.

## Planificación vigente

- PUDS: 4 ciclos.
- 12 casos de uso: CU-00 a CU-11.
- 3 CUs por ciclo.

## Ciclo actual

Ciclo 2 — Elaboracion, usuarios y colaboracion.

## CU activo

CU-03 — Persistencia y gestion de proyectos. Estado: EN PROGRESO; Incremento 1 completado (13/13). Incrementos 2 y 3 no iniciados.

## OpenSpec activo

`cu-03-project-persistence-management`.

- Incremento 1 completado: Prisma 6, decoder estructural `unknown -> ProjectDocument/ProjectResource`, schema/migracion inicial, mapper/modulo Prisma y round-trip PostgreSQL JSONB real.
- `db:migrate:test` protege que `TEST_DATABASE_URL` apunte a `localhost:5432/examen_sw1_test`; la prueba usa UUID aleatorio y elimina solamente su propia fila.
- Los contratos de lifecycle REST, UI, editor, guardado, dirty/conflictos y browser no fueron implementados.
- Docker no esta disponible, pero no bloquea: la migracion existente fue aplicada a PostgreSQL local aislado y la prueba de integracion ya no esta omitida.

## Trabajo terminado en CU-02

- Ruta `frontend/app/editor/page.tsx` agregada sin migrar a `frontend/src/app`.
- Boundary cliente `UmlEditorClient` agregado.
- Workspace Material UI con AppBar, sidebar, toolbox, canvas, inspector, diagnostics y status bar.
- React Flow proyecta `ProjectDocument.model` + `ProjectDocument.layout` mediante adapter.
- Custom nodes de clase y enum, y edge custom de relaciones.
- Zustand expone `currentDocument` como snapshot sincronizado con `UmlHistory`.
- Extensiones `uml-core`: enums, literals, generalization, delete relationship y `ApplyLayout`.
- ELK integrado como calculo temporal para Auto Layout via un solo `ApplyLayout`.
- Correccion del loop `Maximum update depth exceeded`: guardas contra updates redundantes de Zustand y callbacks React Flow memoizados.
- Responsive compacto endurecido: sidebar e inspector se abren como Drawers temporales desde AppBar.
- Correccion duplicate key en enum literals: React key basada en `literal.id`, no en texto visible.
- Correccion React Flow sizing: raiz `100dvh`, fila central `minmax(0, 1fr)`, canvas/region con width-height 100% y MiniMap oculto en compacto.
- Inspector permite cambiar tipos de atributos con `UpdateAttribute.attributeType` y `UmlTypeRef` existente.
- Correccion flujo relaciones: association/aggregation/composition/generalization con feedback source-target, cancelacion y rechazo controlado de self-relations.
- React Flow monta solo tras medir contenedor y ejecuta `fitView()` visual en resize/breakpoint/layout sin mutar `DiagramLayout`.
- React Flow usa instancia estable via `onInit`, readiness one-way, mediciones redondeadas y clave de refit para evitar loops `StoreUpdater/setNodes`.
- React Flow ahora monta dentro de `react-flow-host`, wrapper directo absoluto `inset: 0` medido por `ResizeObserver`, para resolver el warning #004 persistente.
- Skill `uml-editor-design` actualizada de `Technical Canvas / Modeling IDE` a `Blueprint Workbench`.
- Composicion visual: Model Rail izquierdo, canvas dominante, Tool Dock bottom-center, Property Sheet/diagnostics derecho e IDE StatusBar.
- Toolbox vertical desktop eliminado como composicion principal; relaciones ahora salen de menu `Relation` en Tool Dock.
- AppBar y StatusBar ajustados para truncamiento/overflow responsive; StatusBar usa nombres visibles de seleccion cuando puede.
- Inspector de atributos pulido con tarjetas verticales para nombre, tipo y eliminar.
- Skill local `uml-editor-design` creada en `.opencode/skills/uml-editor-design/` para futuras decisiones visuales del editor; puede requerir reiniciar OpenCode para aparecer como skill disponible.
- Skill `uml-editor-design` aplicada: Model Rail, Tool Dock, Property Sheet, diagnostics integrados, nodos/edges Blueprint, AppBar/StatusBar densos y sin cambios de dominio.
- Documentacion CU-02 creada.
- Iteracion correctiva final: compacto ahora usa AppBar esencial, canvas central unico, Tool Dock reducido con `More`, StatusBar abreviado, Model Rail Drawer desde `Menu` e Inspector/Property Sheet Drawer desde `Props`.
- React Flow #004: readiness ahora exige `offsetWidth`/`offsetHeight` reales del `react-flow-host` cuando existen, el host queda como padre directo absoluto `inset: 0` y `html`/`body` quedan dimensionados/overflow hidden por `GlobalStyles`.
- Segunda correccion estricta de React Flow #004: el parent DOM real es `react-flow-host`; ahora `requestAnimationFrame` mide `clientWidth/clientHeight` del host directo y no monta React Flow si `ResizeObserver.contentRect` es no-cero pero el host sigue reportando `0x0`.
- Diagnostico hydration/breakpoint: `useMediaQuery` existia en `UmlEditorClient` y `EditorStatusBar` sin `{ noSsr: true }`. Se cambio a `noSsr` y `UmlCanvas` espera hydration cliente antes de medir/montar React Flow.
- Correccion SSR/hydration: `noSsr: true` fue causa del mismatch para markup estructural. Ahora `UmlEditorClient` usa `mediaCompact` normal pero fuerza `compact=false` hasta despues de hydration; `EditorStatusBar` recibe ese valor y `UmlCanvas` usa `canMount={isHydrated}`.
- FitView: unico llamado automatico en `UmlCanvas`; en compacto ahora usa padding menor y `minZoom` legible para evitar diagrama demasiado alejado.
- Relaciones: `onNodeClick` prioriza source/target en relation mode, ignora ruido de `onSelectionChange` mientras hay herramienta de relacion activa y conserva kind/source/target reales en `ProjectDocument`.
- Verificacion manual final aceptada: responsive/mobile carga, Drawers Model Rail/Inspector funcionan, crear/seleccionar/renombrar clase desde responsive funciona, canvas sigue usable, sin hydration mismatch, sin React Flow #004 y sin `Maximum update depth exceeded`.
- OpenSpec archivado en `openspec/changes/archive/2026-09-07-cu-02-manual-uml-workspace`.
- Tasks finales: 129/129 completas.

## Problemas abiertos

- `npm audit` reporta 5 vulnerabilidades transitivas (2 moderadas, 3 altas) despues de Prisma; no se aplicó fix forzado.
- Docker no se reconoce en la maquina; no bloquea la persistencia local verificada.
- Deuda menor: `favicon.ico` devuelve 404.
- Deuda tecnica/accessibility: Chrome muestra `Blocked aria-hidden on an element because its descendant retained focus` al usar Drawer MUI; no bloqueo el funcionamiento observado.
- Warnings LF/CRLF de Windows aparecen en `git diff --check`; no son errores de whitespace.

## Tests actuales

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
- `npm run db:migrate:test --workspace backend`: verde; sin migraciones pendientes tras aplicar la inicial a `examen_sw1_test`.
- `npm run test:integration --workspace backend`: verde, 1 test PostgreSQL real, sin skip.
- `npm run test --workspace backend`: verde, 4 tests con integracion activa.
- `npm run typecheck --workspace backend`: verde.
- `npm run lint --workspace backend`: verde.
- `npm run build --workspace backend`: verde.

## Siguiente acción exacta

Esperar instruccion para iniciar exclusivamente Incremento 2. Mantener Incremento 3 y Final Verification intactos.
