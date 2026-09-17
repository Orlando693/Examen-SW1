# Project Handoff

## CU activo

CU-08 - Asistentes de texto y benchmark LLM. ACTIVE; Incremento 1 COMPLETE, Incrementos 2 y 3 NOT STARTED.

## OpenSpec activo

`cu-08-local-text-assistant` en `openspec/changes/cu-08-local-text-assistant/`.

## Trabajo terminado

- CU-07 esta CLOSED/ARCHIVED y entrega contratos API, `DomainManifest` v1 y frontend web generado.
- Incremento 1 creo `@examen-sw1/assistant-core`: `AssistantCommand` v1 cerrado, decoder fail-closed, contexto UML read-only, resolucion ID/nombre con ambiguedad explicita, preview/apply, confirmacion destructiva, stale revision y contrato de permisos.
- Las mutaciones UML usan exclusivamente `AssistantCommand -> adapter -> UmlCommand -> UmlCommandBus`; no hay mutacion directa de documento/modelo. `summarize_model` es read-only.
- `DomainManifest` no tiene execution role: sera solo contexto/contrato read-only en Incremento 2.
- Evidencia: assistant-core 11 PASS; aggregate 408 PASS; typecheck/lint/build, Prisma DEV/TEST, OpenSpec strict y diff check PASS.

## Trabajo pendiente

- Esperar aprobacion explicita para Incremento 2. No instalar node-llama-cpp, Qwen, GGUF o Transformers.js antes de esa aprobacion.

## Limitaciones vigentes

- `npm audit --omit=dev` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas); sus fixes exigen upgrades mayores no aprobados.
- La coordinacion realtime es de un solo proceso hasta CU-11.

## Siguiente accion exacta

Tras aprobacion explicita, continuar Incremento 2 de `cu-08-local-text-assistant`; no archive, push ni CU-09.
