# CU-01 - Nucleo UML canonico

## Objetivo

Crear el nucleo de dominio UML canonico del proyecto como paquete TypeScript reutilizable y framework-agnostic.

## Alcance

- Se creo `packages/uml-core` como workspace npm.
- Se definio `ProjectDocument` con separacion explicita entre `model` semantico y `layout` visual.
- Se implementaron tipos para paquetes, clases, atributos, operaciones, enumeraciones, literales, relaciones, multiplicidades, tipos UML y metadatos de generacion.
- Se implemento un motor unico de validacion reutilizable.
- Se implemento un Command Bus UML inicial y Undo/Redo local basado en snapshots.
- Se agregaron tests automatizados del paquete y se integraron los scripts globales del monorepo.

Fuera de alcance:

- UI UML, canvas, React Flow y ELK.
- Persistencia, Prisma, PostgreSQL, autenticacion y colaboracion.
- Generacion de codigo, IA, voz, vision, Flutter y despliegue AWS.

## Dependencias

- Usa solo dependencias de desarrollo ya alineadas con el monorepo: TypeScript, ESLint, Vitest y tipos de Node.
- No tiene dependencias runtime.
- No depende de React, Next.js, Material UI, React Flow, NestJS, Fastify, Prisma ni PostgreSQL.

## Implementacion Realizada

### Paquete

- `packages/uml-core/package.json`: paquete privado `@examen-sw1/uml-core` con scripts `build`, `lint`, `typecheck` y `test`.
- `packages/uml-core/tsconfig.json`: typecheck estricto del paquete.
- `packages/uml-core/tsconfig.build.json`: build a `dist/`.
- `packages/uml-core/eslint.config.js`: lint con reglas TypeScript.
- `packages/uml-core/vitest.config.ts`: configuracion de tests.
- `package.json`: root workspace ahora incluye `packages/*`.
- `package-lock.json`: actualizado por `npm install`.

### Modelo Canonico

- `src/model/document.ts`: `ProjectDocument`, metadata, `ownerId` conceptual opcional, revision, timestamps, helpers de creacion, clonacion y actualizacion.
- `src/model/model.ts`: `UmlModel` y alias `CanonicalUmlModel`.
- `src/model/types.ts`: paquetes, clases, atributos, operaciones, parametros, enumeraciones, literales, visibilidad, tipos UML y metadata de generacion.
- `src/model/relationships.ts`: asociaciones, agregaciones, composiciones y generalizaciones, endpoints y multiplicidad.
- `src/model/layout.ts`: `DiagramLayout` con nodos, posiciones y tamanos visuales referenciados por IDs semanticos.
- `src/ids.ts`: IDs UUID string y helper `createUuid()` usando `globalThis.crypto.randomUUID()` cuando no se entrega ID explicito.
- `src/serialization/serialization.ts`: round-trip JSON determinista para documentos.
- `src/index.ts`: API publica del paquete sin exports de UI o backend.

Decision principal:

`ProjectDocument.model` es la fuente de verdad semantica. `ProjectDocument.layout` contiene solo informacion visual. React Flow no aparece en el dominio persistible.

### Validacion

- `src/validation/diagnostics.ts`: diagnosticos estructurados con severidad `ERROR` o `WARNING`, codigo, mensaje, path logico y referencia opcional al elemento.
- `src/validation/validate.ts`: unica entrada publica `validateProjectDocument()`.
- `src/validation/rules.ts`: lista interna extensible de reglas.

Reglas implementadas:

- IDs duplicados en elementos semanticos y layout.
- Referencias faltantes en relaciones y layout.
- Multiplicidades invalidas o inconsistentes.
- Relaciones mal formadas, endpoints faltantes, endpoints incompatibles y self-generalization.
- Nombres/estructuras requeridas para paquetes, clases, enumeraciones, atributos, operaciones, parametros, literales y relaciones cuando aplica.
- Warning no bloqueante para nombres de clases que no empiezan con mayuscula.

### Command Bus

- `src/commands/commands.ts`: union discriminada `UmlCommand`.
- `src/commands/results.ts`: resultados aceptados/rechazados con diagnosticos y documento resultante.
- `src/commands/executors.ts`: ejecutores deterministas.
- `src/commands/command-bus.ts`: `UmlCommandBus` como entrada para aplicar comandos.

Comandos implementados:

- `CreateClass`
- `DeleteClass`
- `RenameClass`
- `AddAttribute`
- `RemoveAttribute`
- `UpdateAttribute`
- `CreateAssociation`
- `UpdateMultiplicity`
- `MoveNode`

Los comandos clonan el documento antes de mutarlo, validan el candidato cuando corresponde y rechazan errores bloqueantes con diagnosticos estructurados.

`MoveNode` modifica solo `DiagramLayout` y deja intacto `UmlModel`.

### Undo/Redo

- `src/history/uml-history.ts`: historial local basado en snapshots.
- Limite configurable con valor por defecto de 100 operaciones.
- Redo se limpia cuando se ejecuta un nuevo comando aceptado despues de un undo.
- El limite elimina las entradas undo mas antiguas cuando se excede.

## Pruebas Automatizadas

Archivos:

- `packages/uml-core/test/model.test.ts`
- `packages/uml-core/test/validation.test.ts`
- `packages/uml-core/test/commands-history.test.ts`

Cobertura funcional:

- Creacion de `ProjectDocument`.
- Clases, atributos, operaciones, enumeraciones, asociacion, agregacion, composicion, generalizacion y multiplicidades.
- Separacion modelo/layout.
- Serializacion/deserializacion.
- Validacion de modelo valido, IDs duplicados, referencias faltantes, multiplicidad invalida, relaciones mal formadas, nombres invalidos, diagnosticos `ERROR`/`WARNING` y contrato publico completo de `ValidationDiagnostic`.
- Command Bus para creacion/renombrado de clases, atributos, asociaciones, multiplicidades, rechazos, comando runtime no soportado y fallos de validacion.
- Undo, redo, limpieza de redo, limite de historial y restauracion determinista.

## Verificacion Ejecutada

- `npm run test --workspace @examen-sw1/uml-core`: verde, 25 tests.
- `npm run typecheck --workspace @examen-sw1/uml-core`: verde.
- `npm run lint --workspace @examen-sw1/uml-core`: verde.
- `npm run build --workspace @examen-sw1/uml-core`: verde.
- `npm run test`: verde.
- `npm run typecheck`: verde.
- `npm run lint`: verde.
- `npm run build`: verde.

## Errores Encontrados y Correcciones

- Error TypeScript en `commands/executors.ts`: el helper `reject()` tenia un overload imposible que inferia `never`. Se simplifico a una firma concreta con razones permitidas.
- Error lint en `commands/executors.ts`: tipo `Executor` no usado. Se elimino.
- Error lint en `validation/rules.ts`: import `UmlEnumeration` no usado. Se elimino.
- Correccion de verificacion: se reemplazo el import Node-specific `node:crypto` por Web Crypto via `globalThis.crypto.randomUUID()` para mantener UUID reales sin dependencia externa y preparar el consumo desde Node.js 24 y navegadores modernos.
- Correccion de verificacion: se agregaron tests positivos explicitos para `aggregation` y `generalization` valida.
- Correccion de verificacion: se agrego test del contrato completo de `ValidationDiagnostic` para un error.
- Correccion de verificacion: se agrego test defensivo de comando runtime no soportado mediante cast solo en test, sin debilitar el union `UmlCommand` de produccion.

## Limitaciones Conocidas

- El modelo UML inicial cubre el nucleo requerido para CU-01, no todas las construcciones UML posibles.
- Undo/Redo es local y basado en snapshots; no implementa colaboracion ni almacenamiento persistente.
- `deserializeProjectDocument()` asume JSON valido con forma compatible; la validacion estructural profunda se hace con `validateProjectDocument()` despues del parseo cuando corresponda.
- `npm audit` sigue reportando 2 vulnerabilidades moderadas transitivas; no se aplico `npm audit fix --force` para evitar cambios mayores no aprobados.

## Deuda Tecnica

- No hay deuda tecnica bloqueante detectada para CU-01.
- En CUs posteriores se debera conectar este paquete con UI, persistencia, colaboracion y generadores sin saltarse el Command Bus ni duplicar validacion.

## Resultado Final

CU-01 queda implementado, verificado localmente, aceptado por el usuario y archivado como `openspec/changes/archive/2026-09-05-cu-01-canonical-uml-core`. Las specs principales quedaron sincronizadas en `openspec/specs/canonical-uml-core/spec.md` y `openspec/specs/project-foundation/spec.md`.

## Commit de Cierre

Pendiente de commit/push.
