# Project Handoff

## Estado actual

No hay CU ni cambio OpenSpec activo. La correccion post-archive CU-08 `fix-assistant-model-owned-create-ids` esta CLOSED/ARCHIVED como `openspec/changes/archive/2026-09-19-fix-assistant-model-owned-create-ids`; CU-09 no se ha iniciado.

## Ultimo cierre

- Causa raiz resuelta: el modelo podia proponer IDs de entidades nuevas en colision. Grammar/prompt los excluyen y el adaptador los omite antes del `UmlCommandBus`, que asigna IDs confiables.
- Referencias por ID de targets existentes se preservan.
- assistant-core 14/14, local-llm 27/27, backend assistant 17/17, frontend 183/183, Playwright 8/8, raiz equivalente 462/462, smoke real Qwen, typecheck/lint/build y OpenSpec strict PASS.
- El benchmark real no se repitio; no hubo `ECONNRESET`.

## Limitaciones vigentes

- `npm audit --omit=dev` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas); sus fixes exigen upgrades mayores no aprobados.
- La coordinacion realtime es de un solo proceso hasta CU-11.

## Siguiente accion exacta

Planificar CU-09 solo cuando el usuario lo solicite y apruebe el plan. No implementar CU-09 todavia.
