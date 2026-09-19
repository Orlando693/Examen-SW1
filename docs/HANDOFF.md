# Project Handoff

## Ultimo CU cerrado

CU-08 - Asistentes de texto y benchmark LLM. CLOSED/ARCHIVED; Incrementos 1, 2 y 3 COMPLETE.

## OpenSpec archivado

`cu-08-local-text-assistant` en `openspec/changes/archive/2026-09-18-cu-08-local-text-assistant/`. Las dos delta specs se sincronizaron a las specs principales.

## Trabajo terminado

- CU-07 esta CLOSED/ARCHIVED y entrega contratos API, `DomainManifest` v1 y frontend web generado.
- Incremento 1 creo `@examen-sw1/assistant-core`: `AssistantCommand` v1 cerrado, decoder fail-closed, contexto UML read-only, resolucion ID/nombre con ambiguedad explicita, preview/apply, confirmacion destructiva, stale revision y contrato de permisos.
- Las mutaciones UML usan exclusivamente `AssistantCommand -> adapter -> UmlCommand -> UmlCommandBus`; no hay mutacion directa de documento/modelo. `summarize_model` es read-only.
- `DomainManifest` no tiene execution role: sera solo contexto/contrato read-only en Incremento 2.
- Evidencia final Incremento 2: validacion equivalente a raiz 429/429 PASS sin fallos ni skips inesperados: frontend 176, backend 159, assistant-core 12, local-llm 20, UML core 36, relational core 10, spring-generator 7, generated-api-contracts 5, domain-manifest 1 y frontend-generator 3. `npm test` literal no completo por el limite externo de 10 minutos; las suites sin resultado final se ejecutaron individual y secuencialmente con sus scripts normales. typecheck/lint/build, Prisma DEV/TEST, OpenSpec strict y diff check PASS.
- Incremento 2 contiene el runtime local: `@examen-sw1/local-llm`, `node-llama-cpp` 3.21.1, `LocalLlmAssistantProvider` y `NodeLlamaRuntime` con ciclo de vida, carga local, contexto/prompt acotado, timeout, cancelacion y busy policy.
- El GGUF externo verificado no esta en Git: Qwen3-1.7B-Q4_K_M, 1,282,439,264 bytes, SHA-256 `d2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5`.
- Evidencia real: Windows x64 CPU prebuilt, fallback seguro desde Vulkan, carga correcta y smoke opt-in que genero `summarize_model` valido por el decoder de `assistant-core`; local-llm 20/20 PASS sin binario.
- Incremento 3 implemento el panel CASE/UML, adaptador backend autenticado de solo lectura, dataset sintetico versionado y runner. RTL 4/4, E2E Chromium 7/7 y validacion raiz equivalente 449/449 PASS; typecheck/lint/build y Prisma DEV/TEST PASS.
- El benchmark medido de 2026-09-18 completo los 15 IDs versionados sin duplicados con Qwen3-1.7B-Q4_K_M, contexto 2048: schema 15/15, operacion exacta 8/15, referencias 9/15, clarificacion 0/1 y fallo cerrado 9/15. Total 2030339.3346000002 ms, promedio 135355.95564 ms y primera respuesta promedio 88662.14462666665 ms. El JSON completo queda fuera de Git; el resumen sanitizado esta en `docs/puds/use-cases/CU-08-local-text-assistant.md` y no contiene prompts ni chain-of-thought.

## Trabajo pendiente

- No hay CU activo. CU-09 es el siguiente por orden, pero no se ha iniciado.
- CRUD e integracion de asistente sobre instancias de aplicaciones generadas permanecen deferred fuera de CU-08 y requieren una propuesta independiente.

## Limitaciones vigentes

- `npm audit --omit=dev` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas); sus fixes exigen upgrades mayores no aprobados.
- La coordinacion realtime es de un solo proceso hasta CU-11.

## Siguiente accion exacta

Esperar una solicitud o aprobacion explicita para planificar CU-09. No iniciar CU-09 automaticamente.
