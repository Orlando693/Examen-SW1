# Project Handoff

## Estado actual

Correccion post-archive CU-08 activa: `fix-assistant-model-owned-create-ids`. No reabre ni modifica el archive CU-08; CU-09 no se ha iniciado.

## Trabajo terminado

- Grammar y prompt local no permiten IDs de create para clase, atributo o relacion.
- El adaptador descarta IDs de create incluso desde candidatos completos de bypass; `UmlCommandBus`/executor conserva la asignacion UUID confiable.
- Referencias por ID de targets existentes se preservan.

## Evidencia cerrada

- assistant-core 14/14; local-llm 27/27; backend assistant 17/17; frontend 183/183; Playwright 8/8 PASS.
- Root-equivalent secuencial 462/462; typecheck/lint/build y OpenSpec change/main strict PASS.
- Smoke GGUF/Qwen y benchmark real no se ejecutaron. No hubo `ECONNRESET`.

## Limitaciones vigentes

- `npm audit --omit=dev` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas); sus fixes exigen upgrades mayores no aprobados.
- La coordinacion realtime es de un solo proceso hasta CU-11.

## Siguiente accion exacta

Obtener aceptacion; despues ejecutar verify/archivo solo si se solicita, y realizar el commit local de la correccion. No hacer push.
