# CU-08 - Asistentes de Texto y Benchmark LLM

## Objetivo

Permitir operaciones mediante lenguaje natural local, estructurado y validado, sin conceder a la IA autoridad para ejecutar acciones arbitrarias.

## Alcance planificado

- Lenguaje cerrado `AssistantCommand`: `LIST`, `GET`, `SEARCH`, `CREATE`, `UPDATE`, `DELETE` y `COUNT`.
- Adaptacion a `UmlCommandBus` para el editor CASE.
- Preview, review, apply, cancel y confirmacion destructiva.
- Provider local node-llama-cpp con Qwen3 1.7B cuantizado y benchmark LLM reproducible.

## Dependencias

- CU-07: `DomainManifest` v1 y aplicacion generada con contratos OpenAPI.
- CU-01/CU-05: `CanonicalUmlModel`, validacion semantica y `UmlCommandBus`.
- CU-04: autenticacion y control de acceso a proyectos.

## OpenSpec

- Archivado: `openspec/changes/archive/2026-09-18-cu-08-local-text-assistant`.
- Estado: CLOSED/ARCHIVED. Los tres incrementos fueron aceptados, las especificaciones principales se sincronizaron y el cambio fue archivado.

## Implementacion realizada

- Se creo `@examen-sw1/assistant-core`, independiente de frameworks y sin runtime LLM.
- `AssistantCommand` v1 acepta solo create/rename/delete class, add/update/delete attribute, create/update/delete relation y `summarize_model`.
- El decoder estricto rechaza campos extra, operaciones desconocidas, payloads incompletos y valores inseguros.
- `AssistantModelContext` serializable deriva solo clases, enums, relaciones, IDs, revision y seleccion opcional; no contiene layout, React Flow ni datos de DB.
- La resolucion usa IDs canonicos o nombres unicos. Nombres duplicados producen `needs_clarification` con candidatos; nunca se selecciona silenciosamente.
- Preview no tiene efectos, incluye IDs afectados, diagnosticos, metadatos UML, revision y confirmacion destructiva. Apply rechaza preview stale, permisos denegados y deletes sin confirmacion.
- Las mutaciones pasan exclusivamente por `AssistantCommand -> adapter -> UmlCommand -> UmlCommandBus -> executor`. El package no modifica `ProjectDocument` ni `CanonicalUmlModel` directamente.
- `summarize_model` es una operacion determinista de solo lectura.
- Se creo `@examen-sw1/local-llm` con `LocalLlmAssistantProvider`, `NodeLlamaRuntime`, estados de ciclo de vida, carga local configurable, contexto/prompt acotado, timeout, cancelacion y politica de una generacion activa.
- El modelo externo autorizado `Qwen3-1.7B-Q4_K_M.gguf` se verifico fuera del repositorio con 1,282,439,264 bytes y SHA-256 `d2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5`.
- En Windows x64, el prebuilt de `node-llama-cpp` uso CPU tras rechazar Vulkan; el smoke opt-in cargo el modelo y genero un `summarize_model` valido que paso el decoder estricto de `assistant-core`.
- La grammar completa proyectada para node-llama-cpp cubre las variantes seguras de referencias y multiplicidades sin cambiar `AssistantCommand`; los smokes reales `create_class`, `add_attribute`, `create_relation` y `summarize_model` pasaron el decoder estricto sin aplicar mutaciones.
- El runtime local usa una sola carga de modelo y sesiones/sequences aisladas por request. Evidencia real y determinista confirma busy, cancelacion, timeout, streaming sin decode parcial y recuperacion a READY. La fidelidad semantica exacta de una respuesta LLM queda fuera de este contrato de runtime y pertenece a evidencia de calidad/benchmark posterior.
- La adaptacion validada de `AssistantCommand` a `UmlCommand` usa exclusivamente `UmlCommandBus`; preview y adapter no mutan el documento, y `summarize_model` permanece read-only.
- Antes de apply se revalidan revision, permiso, referencias canonicas, confirmacion destructiva y semantica mediante el bus aislado; previews cancelados o invalidos no despachan comandos.
- El panel CASE/UML solicita interpretacion al adaptador backend autenticado de solo lectura, muestra streaming solo como presentacion y permite apply exclusivamente desde un preview final. `executeAndSync()` conserva la ruta normal de colaboracion y `UmlCommandBus`.
- `ASSISTANT_BENCHMARK_DATASET` versionado contiene solo fixtures sinteticos, incluidos intentos ambiguos, faltantes, malformados, no soportados e inseguros. El runner produce JSON fuera del source tree para evitar persistir trazas o prompts de usuarios.
- El resultado completo medido del 2026-09-18 se conserva fuera de Git, como exige el runner. Su resumen durable y sanitizado: dataset `assistant-command-v1-case-uml-2026-09-18`; Qwen3-1.7B-Q4_K_M de `ggml-org/Qwen3-1.7B-GGUF`; contexto 2048; timeout 300000 ms; presupuesto de contexto 6000 caracteres; generacion maxTokens 128, temperature 0.7, topP 0.8, topK 20, minP 0 y thoughtTokens 0; concurrencia 1; Windows x64, Node v24.19.0, Intel i5-5300U (4 CPUs logicos); carga 23730.8335 ms; RSS 50253824 -> 104837120 bytes; heap 5592944 -> 31297896 bytes; VRAM no aplicable; observacion manual no registrada.
- Los 15 casos esperados se completaron sin duplicados y sin mutacion. Agregados medidos: schema 15/15, operacion semantica exacta 8/15, resolucion de referencias 9/15, clarificacion 0/1 y fallo cerrado 9/15. Latencia total 2030339.3346000002 ms, promedio 135355.95564 ms; 15 primeras respuestas, promedio 88662.14462666665 ms. El resumen no conserva prompts, salidas textuales ni chain-of-thought.

## Decisiones tecnicas

- La salida del modelo es entrada no confiable y debe decodificarse y validarse antes de preview o ejecucion.
- Ninguna mutacion UML puede evitar `UmlCommandBus`.
- `DomainManifest` no es execution adapter y no participa en ejecucion dentro de CU-08.
- CRUD sobre instancias de aplicaciones generadas queda fuera de CU-08: requiere un command model de datos de aplicacion y una capa autenticada de ejecucion OpenAPI, ambos sujetos a una propuesta futura separada.
- Incremento 3 integra el asistente solamente con el editor CASE/UML mediante un adaptador backend autenticado y read-only para interpretacion. El browser no importa `@examen-sw1/local-llm`, node-llama-cpp ni el GGUF; tras aprobacion explicita, el editor usa su `executeAndSync()` existente para conservar colaboracion y `UmlCommandBus`.
- No hay fallback remoto ni binarios de modelo versionados en el repositorio.

## Pruebas automatizadas

- `@examen-sw1/assistant-core`: 12/12 PASS. Cubre schemas, fallos cerrados, contexto, IDs/nombres, ambiguedad, preview/cancel sin mutacion, confirmation, permisos, stale state, adapter, Command Bus, provider determinista y revalidacion inmediata antes de apply.
- `@examen-sw1/local-llm`: 20/20 PASS sin modelo; el smoke real opt-in de `summarize_model` PASS con el GGUF externo verificado.
- Root-equivalent workspace validation: 429/429 PASS sin fallos ni skips inesperados: frontend 176, backend 159, assistant-core 12, local-llm 20, uml-core 36, relational-core 10, spring-generator 7, generated-api-contracts 5, domain-manifest 1 y frontend-generator 3. El `npm test` literal se inicio correctamente pero no completo por el limite externo de 10 minutos; las suites sin resultado final se ejecutaron individual y secuencialmente con el mismo script normal del workspace.
- Root typecheck, lint y build PASS.
- Prisma generate/validate, DEV migrate deploy y TEST migrate deploy PASS con cinco migraciones sin pendientes.
- Incremento 3: React Testing Library 4/4 PASS; Playwright Chromium 7/7 PASS con proveedor determinista y PostgreSQL real; la cobertura incluye preview/apply, cancelacion, delete cancel/apply con confirmacion, ambiguedad, intent invalido y denial/ocultamiento. La validacion equivalente a raiz fue 449/449 PASS sin `ECONNRESET` (frontend 182, backend 173, assistant-core 12, local-llm 24, UML core 36, relational core 10, spring-generator 7, generated-api-contracts 5, domain-manifest 1 y frontend-generator 3). El `npm test` literal excedio el limite externo y no recibio sus URLs PostgreSQL; no se uso como evidencia final.
- El benchmark completo medido registro los 15 casos y sus metricas reales. Sus resultados de calidad y seguridad son los agregados documentados arriba; no se establecieron umbrales ni se inventaron observaciones.

## Pruebas manuales

- Incremento 1 no requirio UI ni runtime LLM.
- Incremento 2: carga CPU y generacion read-only real PASS mediante smoke opt-in.
- Incremento 3: E2E browser automatizado PASS. El benchmark real completo produjo el registro temporal validado y el resumen durable sanitizado.

## Errores y correcciones

- Ninguno durante la planificacion.
- Correccion activa `fix-assistant-model-owned-create-ids` (2026-09-19): la grammar y prompt local ya no ofrecen `classId`, `attributeId` ni `relationId` para `create_class`, `add_attribute` o `create_relation`. El decoder conserva esos campos opcionales para callers internos y candidatos de bypass, pero el adaptador los descarta antes de `UmlCommand`; `UmlCommandBus`/executor asigna la identidad con su ruta confiable existente. Las referencias por ID de targets existentes se preservan. Regresiones core cubren candidato completo -> preview sin efectos -> apply -> bus -> modelo para clase, atributo y relacion con IDs en colision. El provider determinista y Playwright cubren los tres Apply contra backend/PostgreSQL, verificando una sola entidad nueva, sin duplicado y con endpoints existentes preservados. Evidencia: assistant-core 14/14, local-llm 27/27, backend assistant 17/17, frontend 183/183, Playwright 8/8 y raiz equivalente 462/462. `npm run typecheck`, `npm run lint`, `npm run build`, OpenSpec change strict y main specs strict PASS. No se ejecutaron smoke GGUF/Qwen ni benchmark real; no hubo `ECONNRESET`. El cambio permanece activo, sin archive ni push, hasta la aceptacion correspondiente.
- Correccion posterior `fix-assistant-generation-timeout` (2026-09-18): la solicitud HTTP normal exponia `timeoutMs: 30000` y el proveedor mantenia un default de 20000 ms con dos timers competidores, aunque el benchmark medido requirio hasta 202800 ms. El contrato definitivo fija `LOCAL_LLM_DEFAULT_TIMEOUT_MS` en 300000 ms; el DTO HTTP y el cliente/panel frontend no exponen `timeoutMs`, y la politica DTO rechaza ese campo adicional en ambos endpoints. Controller y service no originan overrides. Solo llamadas directas internas de tests o tooling pueden aportar un override, cuyo presupuesto efectivo es `min(default, override)` y usa un unico timer; la cancelacion externa conserva su diagnostico y el provider vuelve a `READY` despues de timeout o cancelacion. No se agrego variable de entorno ni se modifico `.env.example`, contexto, sampling, grammar, modelo o benchmark.
- Evidencia de la correccion: `@examen-sw1/local-llm` 26/26 PASS (default, override corto/minimo, timeout, cancelacion, clasificacion de primera causa y recovery); backend assistant 16/16 PASS (DTO/controller rechaza `timeoutMs` y service no lo reenvia); `AssistantPanel` frontend 5/5 PASS (solo texto y `AbortSignal`); E2E Playwright aislado 7/7 PASS con `NODE_ENV=test`, proveedor determinista y sin `LOCAL_LLM_MODEL_PATH`; root typecheck, lint y build PASS. El smoke/benchmark GGUF/Qwen fue intencionalmente NOT RUN para esta correccion.

## Limitaciones conocidas

- `cancel` esta representado por descartar el `AssistantPreview`; la UI que lo expone pertenece al Incremento 3.
- `DomainManifest`/backend generado no forman parte de la ejecucion de CU-08 y permanecen read-only/deferred; no existe CRUD de instancias de aplicaciones generadas en este CU.
- La integracion de asistente con aplicaciones generadas tambien queda deferred fuera de CU-08 y requiere contrato y autorizacion propios; Incremento 3 se limita al editor CASE/UML.
- El registro completo de benchmark permanece fuera del repositorio por diseno; este documento conserva su resumen reproducible y sanitizado. La observacion manual medida es `null` (no registrada), no una metrica inventada.
- Voz, imagen, XMI y despliegue no pertenecen a este CU.

## Resultado final

- Los tres incrementos estan implementados y el benchmark medido fue reconciliado. CU-08 esta CLOSED/ARCHIVED; no se inicio CU-09.
