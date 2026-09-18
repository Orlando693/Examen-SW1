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

- Activo: `cu-08-local-text-assistant`.
- Estado: ACTIVE. Incrementos 1 y 2 completados; Incremento 3 no iniciado.

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

## Decisiones tecnicas

- La salida del modelo es entrada no confiable y debe decodificarse y validarse antes de preview o ejecucion.
- Ninguna mutacion UML puede evitar `UmlCommandBus`.
- `DomainManifest` no es execution adapter y no participa en ejecucion dentro de CU-08.
- CRUD sobre instancias de aplicaciones generadas queda fuera de CU-08: requiere un command model de datos de aplicacion y una capa autenticada de ejecucion OpenAPI, ambos sujetos a una propuesta futura separada.
- No hay fallback remoto ni binarios de modelo versionados en el repositorio.

## Pruebas automatizadas

- `@examen-sw1/assistant-core`: 12/12 PASS. Cubre schemas, fallos cerrados, contexto, IDs/nombres, ambiguedad, preview/cancel sin mutacion, confirmation, permisos, stale state, adapter, Command Bus, provider determinista y revalidacion inmediata antes de apply.
- `@examen-sw1/local-llm`: 20/20 PASS sin modelo; el smoke real opt-in de `summarize_model` PASS con el GGUF externo verificado.
- Root-equivalent workspace validation: 429/429 PASS sin fallos ni skips inesperados: frontend 176, backend 159, assistant-core 12, local-llm 20, uml-core 36, relational-core 10, spring-generator 7, generated-api-contracts 5, domain-manifest 1 y frontend-generator 3. El `npm test` literal se inicio correctamente pero no completo por el limite externo de 10 minutos; las suites sin resultado final se ejecutaron individual y secuencialmente con el mismo script normal del workspace.
- Root typecheck, lint y build PASS.
- Prisma generate/validate, DEV migrate deploy y TEST migrate deploy PASS con cinco migraciones sin pendientes.
- OpenSpec change strict, main specs strict y `git diff --check` PASS; solo warnings LF/CRLF conocidos.

## Pruebas manuales

- Incremento 1 no requirio UI ni runtime LLM.
- Incremento 2: carga CPU y generacion read-only real PASS mediante smoke opt-in; no se realizo UI, benchmark ni E2E.

## Errores y correcciones

- Ninguno durante la planificacion.

## Limitaciones conocidas

- `cancel` esta representado por descartar el `AssistantPreview`; la UI que lo expone pertenece al Incremento 3.
- `DomainManifest`/backend generado no forman parte de la ejecucion de CU-08 y permanecen read-only/deferred; no existe CRUD de instancias de aplicaciones generadas en este CU.
- UI, benchmark reproducible, browser E2E y aceptacion final pertenecen exclusivamente al Incremento 3.
- Voz, imagen, XMI y despliegue no pertenecen a este CU.

## Resultado final

- Incrementos 1 y 2 completados y verificados; Incremento 2 esta 6/6 COMPLETE. Incremento 3 no ha iniciado. CU-08 sigue ACTIVE; pendientes Incremento 3, aceptacion, archive y push.
