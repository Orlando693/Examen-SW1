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

Ninguno.

Estado: CU-00, CU-01 y CU-02 COMPLETADOS. Ningun CU activo.

## Casos de uso completados

- CU-00 — Base del proyecto. COMPLETADO. OpenSpec archivado como `openspec/changes/archive/2026-09-04-cu-00-project-foundation`.
- CU-01 — Nucleo UML canonico. COMPLETADO. OpenSpec archivado como `openspec/changes/archive/2026-09-05-cu-01-canonical-uml-core`. Commit `69d1a3b` pusheado.
- CU-02 — Workspace/editor UML manual. COMPLETADO, verificado, aceptado, archivado, commiteado y pusheado. OpenSpec archivado como `openspec/changes/archive/2026-09-07-cu-02-manual-uml-workspace`. Commit `67e5dee` pusheado.

## OpenSpec activo

Ninguno.

## Problemas abiertos

- `npm audit` reporta 2 vulnerabilidades moderadas en dependencias transitivas al instalar desde la raiz. No se ejecutó `npm audit fix --force` para evitar cambios mayores no aprobados.
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

## Próxima acción

Preparar CU-03 — Persistencia y gestion de proyectos.
