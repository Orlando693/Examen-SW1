# Project Handoff

## Correccion activa

`fix-assistant-generation-timeout`, correccion post-archive de CU-08. No reabre ni modifica el archive CU-08, y CU-09 no se ha iniciado.

## Contrato aplicado

- Backend/provider normal: `LOCAL_LLM_DEFAULT_TIMEOUT_MS = 300000`.
- Solo test/tooling directo puede usar override, limitado a `min(default, override)` con un timer.
- DTO HTTP, controller/service y frontend no exponen `timeoutMs`; DTO lo rechaza como campo extra. Abort/cancel sigue usando `AbortSignal`.

## Evidencia terminada

- local-llm 26/26 PASS; backend assistant 16/16 PASS; frontend panel 5/5 PASS.
- E2E Playwright determinista aislado 7/7 PASS, sin modelo local; root typecheck/lint/build PASS.
- Smoke/benchmark GGUF/Qwen no se ejecuto intencionalmente. No hubo `ECONNRESET`.

## Pendiente exacto

- Ejecutar validacion OpenSpec estricta y `git diff --check`, completar checkboxes, revisar staging y crear solo el commit local solicitado.

## Limitaciones vigentes

- `npm audit --omit=dev` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas); sus fixes exigen upgrades mayores no aprobados.
- La coordinacion realtime es de un solo proceso hasta CU-11.

## Siguiente accion exacta

No archivar ni pushear. Tras el commit local, esperar solicitud explicita para la siguiente accion.
