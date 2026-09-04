# PUDS — Casos de uso y ciclos de implementación

## 1. Propósito

Este documento organiza la implementación del proyecto mediante el Proceso Unificado de Desarrollo de Software (PUDS).

La planificación contiene:

- exactamente **4 ciclos**;
- exactamente **12 casos de uso**;
- numeración de `CU-00` a `CU-11`;
- exactamente **3 casos de uso por ciclo**;
- orden lineal de implementación;
- incrementos utilizables al finalizar cada ciclo.

Los casos de uso se implementan uno por uno. Cada CU puede dividirse internamente en un máximo de 3 incrementos cuando su tamaño lo requiera. Los incrementos son unidades técnicas internas y no crean casos de uso adicionales.

---

## 2. Flujo de trabajo de cada CU

```text
seleccionar CU
    ↓
solicitar plan
    ↓
revisar y aprobar plan
    ↓
generar prompt para OpenCode
    ↓
crear/actualizar OpenSpec
    ↓
implementar
    ↓
ejecutar tests
    ↓
probar manualmente
    ↓
iterar correcciones
    ↓
actualizar documentación del CU
    ↓
verify
    ↓
aceptación
    ↓
archive
    ↓
STATUS / HANDOFF cuando corresponda
    ↓
commit
    ↓
push
```

Durante una iteración se mantiene el mismo número de CU y el mismo OpenSpec mientras el CU continúe abierto.

---

# CICLO 1 — INICIO Y BASE ARQUITECTÓNICA

## Objetivo del ciclo

Construir una base ejecutable y estabilizar la arquitectura esencial del editor UML antes de introducir persistencia, colaboración, generación o IA.

## CU-00 — Base del proyecto

**Objetivo:** crear el monorepo y demostrar comunicación frontend → backend.

Incluye:
- Git/GitHub, npm workspaces y estructura monorepo;
- `frontend/` en la raíz con Next.js App Router + TypeScript + Material UI;
- `backend/` en la raíz con NestJS 11 + Fastify + TypeScript;
- scripts raíz;
- Vitest, React Testing Library y pruebas base;
- `.env.example`;
- CORS;
- endpoint `/health`;
- frontend consultando el health del backend;
- build/lint/typecheck/test verdes.

**Resultado usable:** el proyecto puede clonarse, instalarse y levantarse mostrando desde el navegador que la API está disponible.

## CU-01 — Núcleo UML canónico

**Objetivo:** construir la fuente de verdad, su validación y la única ruta de mutación.

Puede dividirse en máximo 3 incrementos:
1. `CanonicalUmlModel`, `ProjectDocument` y `DiagramLayout`.
2. motor único de validación y diagnósticos estructurados.
3. `UmlCommand`, Command Bus/Executor, Undo/Redo e historial configurable.

Incluye el subconjunto UML definido en `product.md`: clases, atributos, operaciones cuando correspondan, enums, visibilidad, tipos, asociaciones, agregación, composición, generalización, multiplicidades, paquetes necesarios y metadatos de generación.

**Resultado usable:** el dominio UML puede crearse, validarse, mutarse y revertirse sin depender del canvas.

## CU-02 — Workspace y editor UML manual

**Objetivo:** construir el primer editor visual funcional sobre el núcleo canónico.

Incluye:
- layout general Material;
- app bar, sidebar, breadcrumbs, inspector, toolbox y status bar;
- React Flow como proyección, nunca como fuente de verdad;
- nodos UML custom;
- creación/edición/eliminación de clases, atributos y enums;
- creación/edición de relaciones y multiplicidades;
- zoom, pan, selección, movimiento y fit;
- `DiagramLayout`;
- ELK.js;
- Undo/Redo en UI;
- diagnósticos visibles y navegación a elementos;
- responsive básico.

**Resultado usable del Ciclo 1:** editor UML manual funcional en memoria, validado y command-driven.

---

# CICLO 2 — ELABORACIÓN, USUARIOS Y COLABORACIÓN

## Objetivo del ciclo

Convertir el editor local en una aplicación multiusuario con proyectos persistidos y colaboración controlada.

## CU-03 — Persistencia y gestión de proyectos

**Objetivo:** persistir el estado completo y ofrecer el flujo de gestión de proyectos.

Incluye:
- PostgreSQL;
- Prisma;
- migraciones;
- persistencia de `ProjectDocument` y `DiagramLayout`;
- revisión optimista y rechazo stale;
- landing y listado de proyectos;
- crear, abrir, guardar, renombrar y eliminar cuando corresponda;
- estados loading/error/empty;
- round-trip de guardado y reapertura.

**Resultado usable:** un proyecto puede crearse, persistirse, cerrarse y abrirse sin pérdida de información.

## CU-04 — Autenticación, ownership e invitaciones

**Objetivo:** agregar identidad, autorización y acceso compartido controlado.

Incluye:
- registro e inicio de sesión;
- JWT Bearer;
- credenciales seguras;
- `ownerId`;
- autorización por proyecto;
- rutas protegidas;
- `ProjectMembership`;
- roles mínimos;
- `ProjectInvitation`;
- expiración y token controlado;
- aceptación/rechazo;
- UI mínima de invitaciones.

**Resultado usable:** usuarios autenticados acceden únicamente a proyectos autorizados y un propietario puede invitar a colaboradores.

## CU-05 — Colaboración realtime y presencia

**Objetivo:** permitir edición simultánea consistente entre miembros autorizados.

Incluye:
- Socket.IO;
- servidor autoritativo;
- operaciones basadas en `UmlCommand`;
- `baseRevision` y nueva revisión tras aceptación;
- persistencia inmediata;
- broadcast;
- rechazo de operaciones obsoletas;
- recuperación del documento autoritativo;
- sesión, selección, cursor, elemento editado y última actividad;
- avatares y estado online/offline.

**Resultado usable del Ciclo 2:** dos o más usuarios autorizados pueden trabajar sobre el mismo proyecto con sincronización y presencia.

---

# CICLO 3 — CONSTRUCCIÓN Y GENERACIÓN DE APLICACIONES

## Objetivo del ciclo

Transformar el modelo UML en una aplicación web funcional y añadir operaciones en lenguaje natural de forma segura.

## CU-06 — UML → modelo relacional y backend Spring generado

**Objetivo:** transformar UML de forma determinista y generar un backend ejecutable.

Puede dividirse en máximo 3 incrementos:
1. `RelationalModel` y reglas UML → relacional.
2. generador Handlebars para Java 21 + Spring Boot 4.x + Gradle + JPA/Hibernate.
3. CRUD avanzado y harness de compilación/pruebas.

Incluye:
- tablas, columnas, PK, FK, unique, indexes;
- 1:1, 1:N, N:M, composición, herencia, enums y nulabilidad;
- create/read/update/delete/list/count;
- pagination, sorting, filtering y search;
- navegación de relaciones;
- compilación Gradle y pruebas del backend generado.

**Resultado usable:** un UML válido genera un backend Spring Boot compilable y probado.

## CU-07 — Contratos, Domain Manifest y frontend web generado

**Objetivo:** generar los contratos machine-readable y una aplicación web funcional.

Puede dividirse en máximo 3 incrementos:
1. OpenAPI del backend Spring mediante `springdoc-openapi` y Postman Collection derivada.
2. Domain Manifest.
3. frontend Next.js App Router + Material UI generado.

Incluye:
- CRUD visual;
- inferencia de controles por tipo;
- listados, detalle, formularios;
- búsqueda, filtros, paginación y ordenamiento;
- relaciones;
- estados loading/error/empty;
- responsive.

**Resultado usable:** la aplicación generada dispone de backend, contratos y frontend web CRUD interoperables.

## CU-08 — Asistentes de texto y benchmark LLM

**Objetivo:** permitir operaciones mediante lenguaje natural sin permitir que la IA ejecute acciones arbitrarias.

Puede dividirse en máximo 3 incrementos:
1. `AssistantCommand`, validator, executor y lenguaje cerrado `LIST/GET/SEARCH/CREATE/UPDATE/DELETE/COUNT`.
2. Qwen3 1.7B + Domain Manifest para la aplicación generada.
3. Qwen + intención UML → `UmlCommand` para el editor CASE.

Incluye:
- node-llama-cpp + Transformers.js;
- salida estructurada;
- allow-lists;
- validación de entidades, campos, tipos y relaciones;
- preview/review/apply/cancel;
- confirmación cuando corresponda;
- benchmark documentado de precisión, seguridad, latencia, RAM/VRAM y configuraciones/prompts.

**Resultado usable del Ciclo 3:** una aplicación generada completa puede operarse visualmente y por lenguaje natural validado.

---

# CICLO 4 — TRANSICIÓN, MOBILE, INTEROPERABILIDAD Y DESPLIEGUE

## Objetivo del ciclo

Completar voz, mobile, interoperabilidad, visión, despliegue y condiciones reales de demostración.

## CU-09 — Voz y aplicación móvil Flutter generada

**Objetivo:** reutilizar el pipeline de comandos mediante voz y generar un cliente móvil real en Flutter.

Puede dividirse en máximo 3 incrementos:
1. Vosk STT local + captura/revisión de transcript.
2. benchmark STT: WER, command success rate, latencia, recursos y edge cases manuales.
3. generador Flutter + Dart, consumo de la API REST Spring y build Android.

La aplicación Flutter es independiente del frontend web Next.js. **No utilizar Capacitor**.

**Resultado usable:** una app generada puede operarse por voz y dispone de un cliente Flutter compilable para Android.

## CU-10 — XMI e imagen → UML

**Objetivo:** completar las entradas externas hacia el modelo canónico.

Puede dividirse en máximo 3 incrementos:
1. XMI 2.1 con `fast-xml-parser`, import/export y pruebas con Enterprise Architect.
2. Sharp + Florence-2 + Transformers.js para imagen → representación UML estructurada.
3. UX de revisión/corrección/aplicación y benchmark VLM.

La salida multimodal nunca se aplica directamente sin validación y ruta de comandos.

**Resultado usable:** el sistema intercambia XMI y convierte imágenes en propuestas UML revisables.

## CU-11 — AWS, offline/LAN, E2E y cierre

**Objetivo:** demostrar el producto completo y cerrar la documentación académica.

Incluye:
- decisión documentada de arquitectura de despliegue AWS;
- despliegue online en AWS;
- funcionamiento local/offline y LAN/hotspot;
- provisión local de modelos IA/STT;
- pruebas multi-cliente;
- pruebas E2E del flujo completo;
- builds finales web/backend/Flutter;
- benchmarks consolidados;
- limitaciones conocidas y deuda técnica;
- reconciliación completa entre código y documentación;
- material fuente para el documento Word final.

**Resultado usable del Ciclo 4:** producto desplegado en AWS, demostrable también en modo local/LAN y documentado según la implementación real.

---

# 3. Resumen de los 4 ciclos

| Ciclo | Casos de uso | Resultado principal |
|---|---|---|
| **Ciclo 1 — Inicio y base arquitectónica** | CU-00 a CU-02 | Editor UML manual funcional |
| **Ciclo 2 — Elaboración, usuarios y colaboración** | CU-03 a CU-05 | Proyectos persistidos y colaboración autorizada |
| **Ciclo 3 — Construcción y generación** | CU-06 a CU-08 | Aplicación web generada + asistente de texto |
| **Ciclo 4 — Transición y cierre** | CU-09 a CU-11 | Voz, Flutter, XMI/visión, AWS, offline y demo final |

Total:

```text
4 ciclos
12 casos de uso
3 CUs por ciclo
CU-00 → CU-11
```

---

# 4. Orden obligatorio

```text
CICLO 1
CU-00 → CU-01 → CU-02

CICLO 2
CU-03 → CU-04 → CU-05

CICLO 3
CU-06 → CU-07 → CU-08

CICLO 4
CU-09 → CU-10 → CU-11
```

---

# 5. Regla de cierre de cada CU

Un CU se considera terminado únicamente cuando:

- criterios de aceptación cumplidos;
- tests relevantes verdes;
- pruebas manuales realizadas cuando correspondan;
- documentación del CU actualizada;
- `STATUS.md` actualizado;
- `HANDOFF.md` actualizado cuando aporte contexto útil;
- OpenSpec verificado;
- usuario acepta el resultado;
- OpenSpec archivado;
- commit realizado;
- push realizado.

---

# 6. Correcciones posteriores

Si el CU sigue activo, la corrección pertenece al mismo CU y al mismo OpenSpec.

Si el CU ya fue cerrado, crear un cambio OpenSpec correctivo, probarlo, documentarlo en el CU original y generar un nuevo commit sin reescribir la historia.
