# Project Status

## Estado general

CU-02 completado, verificado, aceptado, archivado, commiteado y pusheado. La verificacion manual real final en Chrome responsive confirmo Ctrl+F5 sin hydration mismatch, sin React Flow #004, sin `Maximum update depth exceeded`, responsive mobile funcional, Model Rail/Inspector mediante composicion compacta, creacion/seleccion/renombrado de clase desde responsive y canvas usable.

## Planificación vigente

- 4 ciclos PUDS.
- 12 casos de uso (`CU-00` a `CU-11`).
- 3 casos de uso por ciclo.
- Flutter reemplaza a Capacitor para la aplicación móvil generada.
- AWS es la plataforma obligatoria de despliegue online.

## Ciclo actual

Ciclo 2 — Elaboracion, usuarios y colaboracion.

## Caso de uso activo

CU-03 — Persistencia y gestion de proyectos.

Estado: EN PROGRESO, Incrementos 1, 2 y 3 COMPLETADOS (38/43). CU-00, CU-01 y CU-02 permanecen COMPLETADOS. Final Verification permanece pendiente.

## Casos de uso completados

- CU-00 — Base del proyecto. COMPLETADO. OpenSpec archivado como `openspec/changes/archive/2026-09-04-cu-00-project-foundation`.
- CU-01 — Nucleo UML canonico. COMPLETADO. OpenSpec archivado como `openspec/changes/archive/2026-09-05-cu-01-canonical-uml-core`. Commit `69d1a3b` pusheado.
- CU-02 — Workspace/editor UML manual. COMPLETADO, verificado, aceptado, archivado, commiteado y pusheado. OpenSpec archivado como `openspec/changes/archive/2026-09-07-cu-02-manual-uml-workspace`. Commit `67e5dee` pusheado.

## OpenSpec activo

`cu-03-project-persistence-management`.

- Incremento 1: dependencias Prisma 6, decoder estructural independiente de framework, envelope `ProjectResource`, schema/migracion inicial, mapper y modulo Prisma implementados y verificados contra PostgreSQL local aislado.
- La migracion se aplica reproduciblemente solo mediante `TEST_DATABASE_URL` a `localhost:5432/examen_sw1_test`; la integracion JSONB valida round-trip, decode estructural, equivalencia semantica, revision, timestamps y versiones. Cada prueba limpia solo su propia fila UUID.
- No hay controladores, endpoints, UI ni integracion del editor; Incrementos 2 y 3 permanecen fuera de alcance.
- Docker no esta disponible en esta maquina, pero no bloquea el Incremento 1: PostgreSQL local aislado esta verificado. Incrementos 2 y 3 permanecen fuera de alcance.
- Incremento 2: lifecycle REST `POST/GET/PUT/PATCH/DELETE /projects`, DTO validation, envelope de errores filtrado, limite de payload de 1 MiB y CAS atomico Prisma por `storageVersion` implementados y probados contra PostgreSQL aislado. Sin auth, ownership filtering, Socket.IO ni UI.
- Regresion Incremento 2 corregida: toda fila persistida que se expone como `ProjectResource` pasa structural decode y `validateProjectDocument()`; una fila estructuralmente valida pero semanticamente invalida retorna `500 INTERNAL_ERROR` filtrado.
- Incremento 3: cliente fetch tipado con decode compartido, landing Material de proyectos (list/create/open/rename/delete CAS), carga de `/editor?projectId=<uuid>`, sesion atomica con `UmlHistory` fresco, UUIDs de dominio, dirty/save/conflict/reload manual y guardas contra resultados asincronos obsoletos implementados y cubiertos.

## Problemas abiertos

- `npm audit` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas) despues de agregar Prisma. No se ejecutó `npm audit fix --force` para evitar cambios mayores no aprobados.
- Docker no esta instalado/disponible (`docker` no se reconoce); no bloquea el Incremento 1 porque la migracion y la integracion usan PostgreSQL local aislado.
- Deuda menor: `favicon.ico` devuelve 404. No bloquea CU-02.
- Deuda tecnica/accessibility: Chrome muestra `Blocked aria-hidden on an element because its descendant retained focus` relacionado con focus al usar Drawer MUI. No impidio el funcionamiento validado.
- Warnings LF/CRLF de Windows aparecen en `git diff --check`; no son errores de whitespace y no bloquean el cierre.

## Verificación actual

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

## Próxima acción

Incremento 3 completado (11/11). Esperar instruccion para iniciar exclusivamente Final Verification; no ejecutar sus tareas, verificar OpenSpec, archivar, commitear ni pushear automaticamente.
