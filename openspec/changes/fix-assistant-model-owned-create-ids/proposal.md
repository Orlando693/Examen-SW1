## Why

El esquema cerrado del asistente permite que la salida no confiable del modelo incluya IDs de nuevas clases, atributos y relaciones. Esos IDs se propagan al `UmlCommand`, de modo que una identidad que colisiona puede hacer que una solicitud de creacion no produzca exactamente una entidad nueva.

La identidad de entidades nuevas debe asignarse solo en la ruta UML confiable; los IDs en la salida del modelo siguen siendo necesarios exclusivamente como referencias a entidades ya existentes.

## What Changes

- Eliminar los campos de identidad de creación de la fuente de schema/grammar proyectada y aclarar el prompt local para que el modelo no emita `classId`, `attributeId` ni `relationId` para entidades nuevas.
- Tratar cualquier identidad de creación que un candidato completo aún aporte como no confiable: no se propagará al `UmlCommand` y la ruta `UmlCommandBus` asignará una identidad única.
- Conservar las referencias por ID o nombre para destinos existentes de add/update/delete y relaciones; no cambiar su resolución ni las garantías de aclaración.
- Añadir regresiones de candidato completo del asistente con identidad de creación que colisiona, y de creación de atributo y relación.

## Capabilities

### New Capabilities

- Ninguna.

### Modified Capabilities

- `local-text-assistant`: la grammar del modelo no ofrece IDs de entidades UML nuevas; una identidad de creación aportada fuera de esa grammar se ignora para que la ruta confiable la asigne, y las referencias a entidades existentes siguen admitiendo IDs canonicos.

## Impact

- Afecta `packages/assistant-core` (contratos, decoder, preview y adaptador), `packages/local-llm` (schema proyectado y prompt) y sus pruebas.
- Puede requerir ajustar fixtures del provider determinista o pruebas backend que construyan candidatos, sin cambiar endpoints, DTOs, proveedores habilitados ni dependencias.
- No cambia realtime, el motor de validación UML, el modelo canónico, el protocolo de colaboración, el benchmark ni Qwen/GGUF.
