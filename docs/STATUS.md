# Project Status

## Estado general

CU-01 implementado, verificado, aceptado y archivado. Pendiente commit y push de cierre. No hay CU activo ni OpenSpec activo.

## Planificación vigente

- 4 ciclos PUDS.
- 12 casos de uso (`CU-00` a `CU-11`).
- 3 casos de uso por ciclo.
- Flutter reemplaza a Capacitor para la aplicación móvil generada.
- AWS es la plataforma obligatoria de despliegue online.

## Ciclo actual

Ciclo 1 — Inicio y base arquitectónica.

## Caso de uso activo

Ninguno.

Estado: CU-01 cerrado funcionalmente. Proxima accion: commit/push de cierre y luego preparar CU-02.

## Casos de uso completados

- CU-00 — Base del proyecto. OpenSpec archivado como `openspec/changes/archive/2026-09-04-cu-00-project-foundation`.
- CU-01 — Nucleo UML canonico. OpenSpec archivado como `openspec/changes/archive/2026-09-05-cu-01-canonical-uml-core`.

## OpenSpec activo

Ninguno.

## Problemas abiertos

- `npm audit` reporta 2 vulnerabilidades moderadas en dependencias transitivas. No se ejecutó `npm audit fix --force` para evitar cambios mayores no aprobados.

## Verificación actual

- `npm run test`: verde.
- `npm run typecheck`: verde.
- `npm run lint`: verde.
- `npm run build`: verde.
- `npm run test --workspace @examen-sw1/uml-core`: verde, 25 tests.
- `npm run typecheck --workspace @examen-sw1/uml-core`: verde.
- `npm run lint --workspace @examen-sw1/uml-core`: verde.
- `npm run build --workspace @examen-sw1/uml-core`: verde.
- `openspec validate "cu-01-canonical-uml-core" --strict`: verde.
- `openspec validate --specs --strict`: verde.

## Próxima acción

Comittear y pushear el cierre de CU-01. Despues preparar la propuesta OpenSpec de CU-02 sin implementar antes de aprobacion.
