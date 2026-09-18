# Project Handoff

## CU activo

CU-08 - Asistentes de texto y benchmark LLM. ACTIVE; Incrementos 1 y 2 COMPLETE, Incremento 3 NOT STARTED.

## OpenSpec activo

`cu-08-local-text-assistant` en `openspec/changes/cu-08-local-text-assistant/`.

## Trabajo terminado

- CU-07 esta CLOSED/ARCHIVED y entrega contratos API, `DomainManifest` v1 y frontend web generado.
- Incremento 1 creo `@examen-sw1/assistant-core`: `AssistantCommand` v1 cerrado, decoder fail-closed, contexto UML read-only, resolucion ID/nombre con ambiguedad explicita, preview/apply, confirmacion destructiva, stale revision y contrato de permisos.
- Las mutaciones UML usan exclusivamente `AssistantCommand -> adapter -> UmlCommand -> UmlCommandBus`; no hay mutacion directa de documento/modelo. `summarize_model` es read-only.
- `DomainManifest` no tiene execution role: sera solo contexto/contrato read-only en Incremento 2.
- Evidencia final Incremento 2: validacion equivalente a raiz 429/429 PASS sin fallos ni skips inesperados: frontend 176, backend 159, assistant-core 12, local-llm 20, UML core 36, relational core 10, spring-generator 7, generated-api-contracts 5, domain-manifest 1 y frontend-generator 3. `npm test` literal no completo por el limite externo de 10 minutos; las suites sin resultado final se ejecutaron individual y secuencialmente con sus scripts normales. typecheck/lint/build, Prisma DEV/TEST, OpenSpec strict y diff check PASS.
- Incremento 2 contiene el runtime local: `@examen-sw1/local-llm`, `node-llama-cpp` 3.21.1, `LocalLlmAssistantProvider` y `NodeLlamaRuntime` con ciclo de vida, carga local, contexto/prompt acotado, timeout, cancelacion y busy policy.
- El GGUF externo verificado no esta en Git: Qwen3-1.7B-Q4_K_M, 1,282,439,264 bytes, SHA-256 `d2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5`.
- Evidencia real: Windows x64 CPU prebuilt, fallback seguro desde Vulkan, carga correcta y smoke opt-in que genero `summarize_model` valido por el decoder de `assistant-core`; local-llm 20/20 PASS sin binario.

## Trabajo pendiente

- CRUD sobre instancias de aplicaciones generadas esta deferred fuera de CU-08: exige un command model de application data y ejecucion OpenAPI autenticada que no forman parte de `AssistantCommand` UML v1. `DomainManifest` permanece read-only.
- Incremento 2 esta completo: una carga de modelo reutiliza sesiones/sequences aisladas por request; busy, cancelacion, timeout, streaming sin decode parcial y recovery READY tienen evidencia real/determinista. Apply revalida estado antes de despachar por el bus. La calidad semantica exacta del LLM pertenece al benchmark posterior, no al contrato de runtime.
- Incremento 3 permanece sin iniciar: UI, benchmark reproducible, browser E2E y aceptacion final.

## Limitaciones vigentes

- `npm audit --omit=dev` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas); sus fixes exigen upgrades mayores no aprobados.
- La coordinacion realtime es de un solo proceso hasta CU-11.

## Siguiente accion exacta

Esperar aceptacion del usuario del Incremento 2 de `cu-08-local-text-assistant`; Incremento 3 permanece sin iniciar. No archive, push ni CU-09.
