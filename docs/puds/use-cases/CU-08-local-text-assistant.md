# CU-08 - Asistentes de Texto y Benchmark LLM

## Objetivo

Permitir operaciones mediante lenguaje natural local, estructurado y validado, sin conceder a la IA autoridad para ejecutar acciones arbitrarias.

## Alcance planificado

- Lenguaje cerrado `AssistantCommand`: `LIST`, `GET`, `SEARCH`, `CREATE`, `UPDATE`, `DELETE` y `COUNT`.
- Validacion contra `DomainManifest` para la aplicacion generada y adaptacion a `UmlCommandBus` para el editor CASE.
- Preview, review, apply, cancel y confirmacion destructiva.
- Provider local node-llama-cpp con Qwen3 1.7B cuantizado y benchmark LLM reproducible.

## Dependencias

- CU-07: `DomainManifest` v1 y aplicacion generada con contratos OpenAPI.
- CU-01/CU-05: `CanonicalUmlModel`, validacion semantica y `UmlCommandBus`.
- CU-04: autenticacion y control de acceso a proyectos.

## OpenSpec

- Activo: `cu-08-local-text-assistant`.
- Estado: ACTIVE. Incremento 1 completado; Incrementos 2 y 3 no iniciados.

## Implementacion realizada

- Se creo `@examen-sw1/assistant-core`, independiente de frameworks y sin runtime LLM.
- `AssistantCommand` v1 acepta solo create/rename/delete class, add/update/delete attribute, create/update/delete relation y `summarize_model`.
- El decoder estricto rechaza campos extra, operaciones desconocidas, payloads incompletos y valores inseguros.
- `AssistantModelContext` serializable deriva solo clases, enums, relaciones, IDs, revision y seleccion opcional; no contiene layout, React Flow ni datos de DB.
- La resolucion usa IDs canonicos o nombres unicos. Nombres duplicados producen `needs_clarification` con candidatos; nunca se selecciona silenciosamente.
- Preview no tiene efectos, incluye IDs afectados, diagnosticos, metadatos UML, revision y confirmacion destructiva. Apply rechaza preview stale, permisos denegados y deletes sin confirmacion.
- Las mutaciones pasan exclusivamente por `AssistantCommand -> adapter -> UmlCommand -> UmlCommandBus -> executor`. El package no modifica `ProjectDocument` ni `CanonicalUmlModel` directamente.
- `summarize_model` es una operacion determinista de solo lectura.

## Decisiones tecnicas

- La salida del modelo es entrada no confiable y debe decodificarse y validarse antes de preview o ejecucion.
- Ninguna mutacion UML puede evitar `UmlCommandBus`.
- `DomainManifest` no es execution adapter: queda reservado como contexto y contrato read-only para el incremento de aplicacion generada.
- No hay fallback remoto ni binarios de modelo versionados en el repositorio.

## Pruebas automatizadas

- `@examen-sw1/assistant-core`: 11/11 PASS. Cubre schemas, fallos cerrados, contexto, IDs/nombres, ambiguedad, preview/cancel sin mutacion, confirmation, permisos, stale state, adapter, Command Bus y provider determinista.
- Aggregate de workspaces: 408/408 PASS sin skips inesperados: frontend 176, backend 159, assistant-core 11, domain-manifest 1, frontend-generator 3, generated-api-contracts 5, relational-core 10, spring-generator 7 y uml-core 36.
- Root typecheck, lint y build PASS.
- Prisma generate/validate, DEV migrate deploy y TEST migrate deploy PASS con cinco migraciones sin pendientes.
- OpenSpec change strict, main specs strict y `git diff --check` PASS; solo warnings LF/CRLF conocidos.

## Pruebas manuales

- No aplica en Incremento 1: no se implemento UI ni runtime LLM.

## Errores y correcciones

- Ninguno durante la planificacion.

## Limitaciones conocidas

- `cancel` esta representado por descartar el `AssistantPreview`; la UI que lo expone pertenece al Incremento 3.
- La integracion con `DomainManifest`, backend generado, node-llama-cpp, Qwen3 y benchmark pertenece al Incremento 2/3.
- Voz, imagen, XMI y despliegue no pertenecen a este CU.

## Resultado final

- Incremento 1 completado y verificado. CU-08 sigue ACTIVE; pendiente Incremento 2, Incremento 3, aceptacion, archive y push.
