# Project Status

## Estado general

CU-00 completado y OpenSpec archivado. El siguiente trabajo funcional será preparar CU-01.

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

Estado: CU-00 COMPLETADO.

## Casos de uso completados

- CU-00 — Base del proyecto. OpenSpec archivado como `openspec/changes/archive/2026-09-04-cu-00-project-foundation`.

## OpenSpec activo

Ninguno.

## Problemas abiertos

- `npm audit` reporta 2 vulnerabilidades moderadas en dependencias transitivas. No se ejecutó `npm audit fix --force` para evitar cambios mayores no aprobados.

## Verificación actual

- `npm run test`: verde.
- `npm run typecheck`: verde.
- `npm run lint`: verde.
- `npm run build`: verde.
- `openspec validate "cu-00-project-foundation" --strict`: verde.
- `openspec doctor`: root ok.
- `openspec verify`: no disponible en el CLI instalado.
- OpenSpec archivado: `2026-09-04-cu-00-project-foundation`.

## Próxima acción

Preparar CU-01 — Núcleo UML canónico. No implementar CU-01 hasta crear/revisar su plan y OpenSpec correspondiente.
