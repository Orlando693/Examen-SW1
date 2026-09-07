# CU-02 - Workspace/editor UML manual

## Objetivo

Construir el primer workspace visual de edicion UML manual sobre `@examen-sw1/uml-core`, manteniendo `ProjectDocument` como fuente de verdad y React Flow como proyeccion visual.

## Alcance

- Ruta `frontend/app/editor/page.tsx` sin migrar a `frontend/src/app`.
- Workspace Material UI con AppBar, sidebar, breadcrumbs, toolbox, canvas central, inspector, diagnostics panel y status bar.
- React Flow integrado como proyeccion visual.
- Custom nodes para clases y enumeraciones.
- Edges diferenciables para association, aggregation, composition y generalization.
- Estado frontend con Zustand y `UmlHistory` como holder controlado del documento editable.
- Demo data temporal en memoria hasta CU-03.
- Extensiones minimas aprobadas en `packages/uml-core`.
- ELK.js como calculo temporal de auto-layout.

Fuera de alcance: persistencia real, localStorage persistente, PostgreSQL, Prisma, backend CRUD, auth, colaboracion, generacion, IA, voz, vision, XMI, Flutter y AWS.

## Arquitectura

```text
UI intent
-> editor action
-> UmlCommand
-> UmlHistory.execute(...)
-> UmlCommandBus / executor
-> ProjectDocument actualizado
-> snapshot Zustand actualizado
-> projection adapter
-> React Flow
```

`ProjectDocument.model` conserva la semantica UML. `ProjectDocument.layout` conserva posiciones visuales. React Flow no se persiste como dominio.

## Componentes

- `frontend/app/editor/page.tsx`: Server Component de la ruta del editor.
- `frontend/components/editor/UmlEditorClient.tsx`: boundary cliente localizado.
- `frontend/components/editor/EditorAppBar.tsx`: titulo, breadcrumbs, Undo, Redo, Auto Layout y toggles compactos.
- `frontend/components/editor/EditorSidebar.tsx`: resumen del documento demo y aviso temporal.
- `frontend/components/editor/EditorToolbox.tsx`: select, class, enum, association, aggregation, composition, generalization y auto-layout.
- `frontend/components/editor/UmlCanvas.tsx`: React Flow, seleccion, drag, fit view y commits de movimiento.
- `frontend/components/editor/InspectorPanel.tsx`: edicion del elemento seleccionado.
- `frontend/components/editor/DiagnosticsPanel.tsx`: diagnostics y navegacion a elementos.
- `frontend/components/editor/EditorStatusBar.tsx`: revision, seleccion y conteo de errors/warnings.
- `frontend/components/editor/nodes/UmlClassNode.tsx`: nodo custom de clase.
- `frontend/components/editor/nodes/UmlEnumNode.tsx`: nodo custom de enumeration.
- `frontend/components/editor/edges/UmlRelationshipEdge.tsx`: edge custom de relacion.

## Server/Client Boundary

`frontend/app/editor/page.tsx` se mantiene como Server Component. El boundary cliente empieza en `UmlEditorClient` y componentes interactivos.

No se convirtio `frontend/app/layout.tsx` ni la aplicacion completa a cliente.

## Zustand, UmlHistory y Fuente Unica

`UmlHistory` mantiene el `ProjectDocument` editable de la sesion. Zustand expone `currentDocument` como snapshot de render, no como segunda copia editable.

Despues de `execute`, `undo` y `redo`, el store reemplaza atomicamente `currentDocument`, recalcula diagnostics con `validateProjectDocument()` y React vuelve a proyectar el documento.

No hay historial React paralelo ni estado mutable UML dentro de componentes.

Las actualizaciones redundantes de seleccion y herramienta activa se ignoran para evitar renders circulares cuando React Flow notifica una seleccion equivalente.

## Projection Adapter y React Flow

`frontend/lib/editor/projection/project-document-to-flow.ts` transforma `ProjectDocument.model` + `ProjectDocument.layout` en nodes/edges React Flow.

React Flow aporta zoom, pan, seleccion, drag/move, fit view, background, controls y minimap. Los nodes/edges contienen datos de render, no el dominio persistente.

## Custom Nodes y Relaciones

Class node muestra nombre, atributos, operaciones y badges de ERROR/WARNING.

Enum node muestra nombre, literales y badges de ERROR/WARNING.

Edges distinguen association, aggregation, composition y generalization, con labels de multiplicidad cuando existen.

## Toolbox e Inspector

Toolbox permite crear clase/enum, seleccionar y crear relaciones. Las relaciones se crean seleccionando clase origen y destino.

En desktop se conserva la composicion Blueprint Workbench aceptada: Tool Dock horizontal bottom-center dentro del canvas con `Select`, `Clase`, `Enum`, `Relation` y `Layout`. Las relaciones se eligen desde el menu `Relation` y la herramienta activa se resalta con tratamiento Signal cyan y `aria-pressed`.

En tablet/mobile el Tool Dock conserva el lenguaje bottom-dock pero reduce acciones permanentes a `Select`, `Clase`, `Relation` y `More`. `More` ofrece `Enum` y `Layout`; el overflow horizontal queda limitado al dock y no a la pagina completa.

Inspector permite renombrar/eliminar clases y enums, gestionar atributos y literales, editar tipos de atributos, editar multiplicidades de relaciones no generalization y eliminar relaciones. La seccion de atributos usa tarjetas por atributo con campos claros para nombre, tipo y eliminacion.

La creacion de relaciones usa estado UI temporal: al elegir Asociacion, Agregacion, Composicion o Herencia el canvas muestra una indicacion de origen/destino. La primera clase queda seleccionada como origen visual, la segunda clase ejecuta un unico comando UML y el draft se limpia. Se puede cancelar con Seleccionar o Escape.

## Skill Local de Diseño

Se agrego la skill local de OpenCode `uml-editor-design` en `.opencode/skills/uml-editor-design/` para que futuras iteraciones visuales del editor mantengan coherencia y eviten una apariencia generica de dashboard SaaS.

Archivos creados:

- `.opencode/skills/uml-editor-design/SKILL.md`: reglas de activacion, restricciones del proyecto, brief obligatorio, workflow de diseño y anti-patterns.
- `.opencode/skills/uml-editor-design/references/design-system.md`: direccion visual Technical Canvas / Modeling IDE, tokens conceptuales, tipografia, densidad, espaciado, radio, sombra y estados.
- `.opencode/skills/uml-editor-design/references/editor-patterns.md`: patrones especificos para AppBar, sidebar, toolbox, canvas, nodos UML, edges, seleccion, creacion de relaciones, inspector, diagnostics, status bar, drawers y responsive.
- `.opencode/skills/uml-editor-design/references/ui-audit.md`: auditoria visual real del CU-02 actual, riesgos y restricciones.

Esta fase no rediseño la interfaz. La skill queda como herramienta de apoyo para futuras correcciones visuales dentro de CU-02 o trabajos posteriores del editor.

## Aplicacion del Sistema Visual

Se aplico la skill `uml-editor-design` en una iteracion posterior de CU-02 para alinear el workspace con la direccion `Technical Canvas / Modeling IDE`.

Luego se corrigio la direccion visual porque seguia percibiendose demasiado generica/MUI. La firma visual vigente de la skill y del editor paso a ser `Blueprint Workbench`: un workbench tecnico de modelado profesional inspirado conceptualmente en espacios CAD/drafting, IDEs tecnicos y canvas tools profesionales, sin copiar una aplicacion concreta.

Brief usado:

- Purpose: editor web tecnico para modelar UML visualmente.
- Audience: estudiantes/desarrolladores principalmente en desktop, con soporte tablet/mobile secundario.
- Visual direction: Blueprint Workbench.
- Reference: herramientas canvas-first, diagramacion profesional e IDEs tecnicos como analogia conceptual.
- Palette: Ink `#0B1F33`, Primary `#164E72`, Signal `#22A7B8`, Canvas `#F3F7F9`, Panel `#F8FAFB`, Grid `#D8E2E8`, Border `#C8D3DA`, amber/red solo semanticos.
- Typography: roles MUI existentes para UI y monospace de sistema para attributes, types, operations, multiplicities y metadata tecnica.
- Density: densa pero respirable.
- Memorable interaction: herramienta activa y creacion de relaciones con source/target claros.
- Restraint: sin gradients decorativos, glassmorphism, acentos morados arbitrarios, exceso de cards ni layout de landing page.

Cambios visuales realizados sin modificar dominio:

- Toolbox convertido en tool strip agrupado: Selection, Elements, Relationships y Layout.
- Sidebar refinado como navegacion/resumen de modelo, con banner DEMO discreto.
- Inspector convertido en secciones contextuales con empty state compacto y diagnostics de la seleccion.
- Diagnostics panel estilizado como parte del inspector/editor, manteniendo navegacion por elemento.
- AppBar compactada como barra de herramienta tecnica, con disabled states claros.
- StatusBar refinado como barra tecnica densa con informacion secundaria reducida en compacto.
- Class/Enum nodes ajustados con jerarquia UML mas clara, divisores sutiles, fuente monospace para miembros y seleccion azul consistente.
- Relationship edges usan paleta tecnica azul/neutra, eliminando acento morado arbitrario para generalization.
- Se preservo `react-flow-host` como parent dimensionado directo para React Flow.

Correccion Blueprint Workbench posterior:

- Se elimino el toolbox vertical desktop como composicion principal.
- Se agrego Tool Dock horizontal bottom-center dentro del canvas.
- Las relaciones se eligen desde un menu `Relation` con Asociación, Agregación, Composición y Herencia.
- El sidebar se convirtio en Model Rail / Explorer con `LOCAL DEMO` compacto.
- El inspector se reforzo como Property Sheet tecnico.
- El canvas usa superficie clara con grilla Blueprint sutil.
- StatusBar paso a estilo IDE inline: `REV`, `LOCAL`, errores/warnings y seleccion.
- Class/Enum nodes usan marker `CLASS`/`ENUM`, radius bajo, borde tecnico, miembros monospace y Signal cyan para seleccion.
- Relationship edges usan strokes sobrios y Signal cyan para selected edge.

No se cambio la ruta de mutacion `UI -> UmlCommand -> UmlHistory -> ProjectDocument`, no se agregaron dependencias visuales y no se implemento CU-03.

## Diagnostics

El frontend usa exclusivamente `validateProjectDocument()` desde `@examen-sw1/uml-core`.

Se muestran `ERROR` y `WARNING`; warnings no bloquean por defecto. Los errores de comando rechazan la operacion sin actualizar parcialmente el documento.

## Extensiones uml-core

- `CreateEnumeration`
- `RenameEnumeration`
- `DeleteEnumeration`
- `AddEnumerationLiteral`
- `UpdateEnumerationLiteral`
- `RemoveEnumerationLiteral`
- `CreateGeneralization`
- `DeleteRelationship`
- `ApplyLayout`

Todos pasan por `UmlCommandBus`/executors, preservan cloning, validacion y contratos `CommandResult`.

## ApplyLayout y ELK

`frontend/lib/editor/layout/auto-layout.ts` convierte temporalmente el grafo proyectado a ELK, calcula posiciones y genera un unico comando `ApplyLayout`.

`ApplyLayout` modifica multiples entradas de `DiagramLayout` en una sola ejecucion y no modifica `CanonicalUmlModel`.

## Undo/Redo

Undo/Redo se exponen en la AppBar y usan `UmlHistory`. Auto Layout equivale a una sola operacion de historial.

## Responsive

El workspace usa breakpoints Material. En desktop sidebar e inspector son persistentes; en pantallas reducidas se abren como `Drawer` temporales desde la AppBar y el canvas mantiene prioridad sin columnas fijas laterales.

La iteracion correctiva final preservo el desktop Blueprint Workbench aceptado y cambio la composicion compacta real a `AppBar -> canvas flexible -> Tool Dock/StatusBar compacto`, con Model Rail e Inspector/Property Sheet como overlays. La AppBar compacta muestra `Menu`, titulo truncado, `Undo`, `Redo` y `Props`; `Layout` paso al menu `More` del Tool Dock compacto para evitar controles superiores ilegibles. La validacion manual final del usuario confirmo que responsive/mobile carga correctamente, que Model Rail e Inspector funcionan mediante la composicion compacta, que se puede crear una clase, seleccionarla, abrir el Inspector y renombrarla desde responsive, y que el canvas permanece usable.

La segunda correccion manual cambio la raiz del editor a `100dvh`, uso `minmax(0, 1fr)` para la fila central, aplico `width: 100%`, `height: 100%`, `minWidth: 0` y `minHeight: 0` a la cadena workspace/canvas, oculto el MiniMap en compacto y permitio wrap/scroll en AppBar, toolbox y status bar para evitar overflow horizontal.

La tercera correccion manual difiere el montaje de React Flow hasta que `ResizeObserver` mide un contenedor con ancho y alto positivos. El viewport visual se reajusta con `fitView()` cuando cambian dimensiones, breakpoint o posiciones del layout, sin modificar `ProjectDocument.layout`. Esto separa `DiagramLayout` de pan/zoom visual.

La cuarta correccion manual elimina el efecto que dependia de `useReactFlow().fitView` en el mismo componente que monta `ReactFlow`. Ahora `UmlCanvas` guarda la instancia con `onInit`, mantiene la readiness del canvas como transicion de una sola via tras la primera medicion positiva, redondea mediciones del `ResizeObserver` e ignora refits ya ejecutados con la misma clave de breakpoint, dimensiones y posiciones. El objetivo es evitar que React Flow `StoreUpdater` reciba props/effects que provoquen escrituras internas repetidas sobre `setNodes`.

La quinta correccion manual redujo el warning React Flow #004 usando `react-flow-host` como wrapper directo. La prueba manual posterior demostro que no era suficiente: en responsive/mobile React Flow podia seguir validando el parent con `offsetWidth`/`offsetHeight` en cero aunque `ResizeObserver.contentRect` reportara dimensiones. La correccion final exige dimensiones reales del host mediante `offsetWidth`/`offsetHeight` cuando existen, mantiene `react-flow-host` como padre directo absoluto `inset: 0` y elimina la dependencia del host en `width: 100%`/`height: 100%` heredados. Tambien fija `html` y `body` con `width`, `height` y `overflow` controlados para que `editor-root` tenga un viewport real de `100dvh`/`100vw`.

La siguiente prueba manual real volvio a fallar: `/editor` respondio 200, pero la consola emitio React Flow #004 tres veces. Esto mostro que la implementacion aun aceptaba `ResizeObserver.contentRect` como fallback permisivo aunque el parent DOM inmediato de `<ReactFlow />` (`react-flow-host`) todavia podia tener `clientWidth`/`clientHeight` cero en el instante del primer mount. La correccion estricta final usa `requestAnimationFrame` para medir el `react-flow-host` directo despues del layout, exige `clientWidth`/`clientHeight` o caja equivalente no-cero antes del primer mount, y mantiene `ResizeObserver` solo para cambios posteriores de viewport/refit. Una vez `ready` pasa a true no vuelve a false por subpixeles o eventos transient.

La evidencia posterior de Chrome cambio la hipotesis: despues de estabilizar la pagina existe 1 `react-flow-host`, 1 `.react-flow` y 1 `.react-flow__renderer`; todos terminan con tamano `464 x 1360.5`. Por tanto #004 no era un estado final de DOM en cero ni una doble instancia, sino un warning transitorio durante hydration/breakpoint. Se auditaron los `useMediaQuery` del editor: `UmlEditorClient` decide composicion desktop/compact y `EditorStatusBar` decide metadata compacta. Ambos usaban el comportamiento SSR por defecto de MUI, que puede hacer un render servidor/default y luego otro con el valor real del navegador. Se cambio a `useMediaQuery(..., { noSsr: true })` y `UmlCanvas` no inicia medicion ni monta React Flow hasta que un `useEffect` confirma hydration cliente.

La prueba manual con Ctrl+F5 demostro el problema real de hydration: Chrome reporto `Hydration failed because the server rendered HTML didn't match the client`. El diff mostro que el cliente esperaba `<button aria-label="Menu">` en `EditorAppBar.tsx:19`, mientras el servidor habia renderizado el `Box` desktop de titulo/contexto. La causa exacta fue usar `useMediaQuery(..., { noSsr: true })` en un breakpoint que cambia markup estructural: `Menu`, AppBar compacta, Model Rail/Inspector persistentes versus Drawers, y StatusBar compacto. Esa opcion permite que el primer render cliente use el ancho real del navegador (`compact=true`) aunque el servidor haya renderizado `compact=false`.

La correccion SSR final elimina `noSsr` para el breakpoint estructural y agrega un guard de hydration en `UmlEditorClient`: servidor y primer render cliente usan `compact=false`; despues de `useEffect`, `compact` toma el valor real de `useMediaQuery`. `EditorStatusBar` recibe ese valor ya protegido y no ejecuta un media query independiente. `UmlCanvas` recibe `canMount={isHydrated}`, por lo que React Flow no monta durante el primer render de hydration ni antes de medir su host directo. La verificacion manual real final con Ctrl+F5 confirmo ausencia de hydration mismatch.

La quinta correccion ajusto AppBar para no hacer wrap descontrolado: en desktop conserva breadcrumb/titulo, Undo, Redo y Auto Layout; en compacto muestra Menu, titulo truncado, Undo, Redo, Layout e Inspector sin salirse del viewport. Sidebar desktop bajo a 248px para no comerse el canvas; inspector desktop queda en 340px con overflow interno. En compacto sidebar e inspector siguen como Drawers overlay y no cambian `DiagramLayout`.

StatusBar ahora reduce informacion secundaria en compacto, evita flex-wrap horizontal, muestra nombres visibles de seleccion cuando existen y trunca el texto restante. Ya no depende de mostrar IDs largos completos como `enumeration:enum-...`.

La correccion final compacto muestra metadata abreviada como `LOCAL`, `0 ERR` y `1 WARN`, mas seleccion truncada por nombre cuando existe. No muestra revision ni IDs largos en mobile.

El zoom mobile se separo del problema #004. El unico `fitView()` automatico vive en `UmlCanvas` y se dispara despues de mount medido con clave de breakpoint, dimensiones y posiciones. En compacto se redujo el padding automatico y se establecio `minZoom` usable para evitar que el auto-fit comprima todo el diagrama hasta hacerlo ilegible. Resize sigue siendo viewport visual y no modifica `ProjectDocument.layout`.

## Attribute Types

El inspector edita tipos de atributos usando `UpdateAttribute.attributeType` y `UmlTypeRef` de `@examen-sw1/uml-core`. Actualmente la UI ofrece primitivas `string`, `number`, `boolean`, `date`, `datetime`, ademas de referencias a clases y enumeraciones existentes en el documento demo. No se creo un sistema de tipos paralelo en frontend.

## Demo Data

`frontend/lib/editor/demo/demo-document.ts` crea un `ProjectDocument` temporal con clases, atributos, operacion, enum, relaciones y posiciones.

No hay persistencia. Recargar la pagina puede reiniciar la demo.

## Tests

Frontend:

- `frontend/app/editor/page.test.tsx`
- `frontend/components/editor/UmlEditorClient.test.tsx`
- `frontend/lib/editor/projection/project-document-to-flow.test.ts`
- `frontend/stores/editor-store.test.ts`
- `frontend/components/health-status.test.tsx`

Las regresiones cubren render inicial sin ejecutar comandos ni actualizar store, seleccion redundante sin notificaciones, drag confirmado solo al finalizar, Undo/Redo, responsive compacto con controles de Drawer, sizing dimensionable del canvas, wrapper directo `react-flow-host`, pureza profunda del projection adapter, literals duplicados sin duplicate key, add/edit/remove de enum literals, cambio de tipo de atributo con Undo/Redo, creacion UI de association/aggregation/composition/generalization, rechazo de self-relation, cancelacion de draft, fitView sin mutar layout, rerender con el mismo documento sin refit/store writes, mediciones repetidas de `ResizeObserver` sin refits redundantes, resize real sin mutar `DiagramLayout`, toolbox desktop con labels completas y grupos, toolbox compacto horizontal, StatusBar compacto con nombres visibles en vez de IDs largos, empty state de inspector y diagnostics contextuales por seleccion.

Las relaciones `association`, `aggregation`, `composition` y `generalization` tienen cobertura automatizada que inspecciona `kind`, `sourceId` y `targetId` reales en `ProjectDocument`, ademas del flujo source/target de UI.

La iteracion correctiva final agrego/reforzo cobertura para composicion mobile sin columnas permanentes, Drawer de Model Rail desde `Menu`, Drawer de Property Sheet desde `Props`, Tool Dock compacto con `More`, relacion association/aggregation/composition/generalization desde el menu `Relation`, source/target/kind inspeccionados directamente en `ProjectDocument`, draft cleanup, seleccion normal sin cancelar accidentalmente relation mode y resize sin mutar `DiagramLayout`. La correccion estricta posterior agrego una prueba especifica donde `ResizeObserver.contentRect` es no-cero pero el parent directo de React Flow sigue en `0x0`; React Flow no monta hasta que ese host reporta dimensiones reales.

La iteracion de diagnostico hydration/breakpoint agrego pruebas para confirmar que rerenders del mismo arbol no remontan React Flow y que el `fitView` automatico en compacto usa `minZoom` legible. La correccion SSR posterior agrego una regresion con `renderToString()` para comprobar que el HTML inicial de servidor queda en la rama desktop-safe y no contiene controles compact-only como `Menu` o `Props` antes de hydration.

Runtime local posterior: `GET /editor` devolvio `200` con HTML de Next.js en puerto aislado `3002` usando servidor temporal. Esta verificacion solo confirma que la ruta sirve HTML; la sesion actual no tiene Playwright ni otra automatizacion de navegador instalada para inspeccionar consola real del cliente sin agregar dependencias. La prueba manual final del usuario es la evidencia de cierre para confirmar ausencia de React Flow #004.

Prueba manual actual del usuario con `npm run dev` en `http://localhost:3000/editor`: la ruta devolvio `GET /editor 200`, pero el navegador reporto repetidamente `[React Flow]: The parent container needs a width and a height to render the graph` y responsive/mobile seguia comprimiendo la interfaz. Tambien se reporto creacion no fiable de Asociacion y Agregacion. Esta evidencia motivo la iteracion correctiva final. Una prueba manual posterior volvio a mostrar #004 despues de esa iteracion, por lo que se aplico la correccion estricta de readiness basada en el parent DOM directo.

Nueva evidencia manual de Chrome: despues de estabilizar, el DOM final tiene 1 host, 1 flow y 1 renderer, todos con `464 x 1360.5`. Esta evidencia descarta doble montaje final o renderer final en cero y apunta a un montaje transitorio durante hydration/breakpoint. La verificacion manual final posterior confirmo la consola limpia.

Nueva evidencia manual Ctrl+F5: hydration mismatch exacto en `EditorAppBar`. Servidor renderizo markup desktop (`Box` de titulo/contexto); cliente esperaba markup compacto (`Button Menu`). Esta evidencia convierte hydration mismatch en causa raiz upstream probable de los warnings #004 posteriores.

Verificacion manual real final aceptada por el usuario: Ctrl+F5 no mostro hydration mismatch, no aparecio React Flow #004, no aparecio `Maximum update depth exceeded`, responsive mobile cargo correctamente, Model Rail/Inspector funcionaron mediante la composicion compacta, se pudo crear una clase en responsive, seleccionar la clase, abrir el Inspector, renombrar la clase desde responsive y mantener el canvas usable.

`uml-core`:

- `packages/uml-core/test/commands-history.test.ts` ampliado con comandos de enum, relaciones, `ApplyLayout`, errores y Undo/Redo.

## Problemas Encontrados y Correcciones

- React Flow no exporta `NodeDragHandler` en la version instalada. Se ajusto el handler a eventos DOM nativos.
- El root build necesitaba construir `@examen-sw1/uml-core` antes que `frontend`. Se ordeno el script root `build`.
- En tests, MUI no expuso un label dinamico como accessible name. Se ajusto la interaccion de test manteniendo cobertura.
- Prueba manual en navegador detecto `Maximum update depth exceeded` en `/editor`. La causa probable fue una combinacion de callbacks React Flow recreados en cada render y escrituras Zustand redundantes de seleccion equivalente. Se memoizaron callbacks de canvas y se agregaron guardas en `setSelection`/`setActiveTool`.
- En la iteracion responsive se detecto que los paneles compactos podian montarse como overlay desde el estado inicial. Se cambio el estado inicial a paneles cerrados y accesibles desde AppBar.
- Segunda prueba manual confirmo que el render loop principal estaba corregido, pero detecto `Encountered two children with the same key, NEW_LITERAL` en `UmlEnumNode`. La causa fue usar el texto visible del literal como React key. `uml-core` ya representa literals como `{ id, name }`, por lo que la proyeccion ahora conserva `id` y el nodo usa `literal.id` como key estable.
- Se reviso el validador de `uml-core`: actualmente valida que los nombres de literals no esten vacios, pero no exige unicidad de nombres dentro del enum. No se agrego una regla UML nueva en CU-02 porque el contrato actual admite edicion temporal con textos repetidos y la identidad real es `literal.id`.
- Segunda prueba manual detecto warning React Flow `parent container needs a width and a height`. La causa fue una cadena de layout que dependia de `height: 100%` sin asegurar dimensiones explicitas en todos los padres y un `minHeight` artificial del canvas. Se corrigio la jerarquia con `100dvh`, grid/flex dimensionado y overflow controlado.
- Segunda prueba manual mostro que faltaba edicion util de tipo de atributo. Se agrego selector de tipo en inspector usando `UpdateAttribute.attributeType` y tipos existentes de `uml-core`.
- Tercera prueba manual detecto que la creacion de relaciones, especialmente agregacion, no era suficientemente fiable ni comunicaba el estado source/target. La causa probable era una combinacion de IDs basados en tiempo, falta de feedback/cancelacion explicita y un flujo UI que dejaba al usuario sin confirmar si el origen estaba tomado. Se cambio a IDs monotonicos por sesion, feedback visible, seleccion de origen, limpieza deterministica del draft y rechazo controlado de self-relations.
- Tercera prueba manual mostro que el inspector de atributos seguia comprimido. Se reemplazo la fila horizontal por tarjetas verticales con campos full-width de nombre y tipo.
- Tercera prueba manual confirmo que el problema responsive tambien era de viewport, no solo de dimensiones. React Flow ahora monta solo con contenedor medido y ejecuta fit visual acotado sin tocar el dominio.
- Cuarta prueba manual reporto de nuevo React Flow #004 y `Maximum update depth exceeded`, esta vez con stack centrado en `StoreUpdater`, `setNodes`, `ReactFlow`, `CanvasInner` y `UmlCanvas`. La causa final corregida fue el acoplamiento entre el montaje condicional de React Flow, mediciones repetidas del contenedor y un efecto de `fitView()` dependiente de `useReactFlow().fitView`, que podia provocar escrituras internas repetidas del store controlado de React Flow. Se cambio a instancia estable via `onInit`, readiness one-way, mediciones redondeadas y deduplicacion explicita de `fitView()`.
- Quinta prueba manual mostro progreso: ya no aparecio `Maximum update depth exceeded`, el editor cargaba y las relaciones mostraban feedback, pero React Flow #004 seguia apareciendo repetidamente. La causa exacta final fue que la medicion ocurria sobre `UmlCanvas`, no sobre el parent DOM directo de React Flow. Se agrego `react-flow-host` absoluto `inset: 0`, se movio la medicion a ese host y se monto React Flow solo dentro de ese wrapper dimensionado.
- Quinta prueba manual tambien reporto toolbox demasiado angosto y scroll horizontal en desktop. Se reemplazo por panel desktop vertical legible con labels completas y modo compacto horizontal intencional.
- Iteracion de sistema visual aplico `uml-editor-design` para evitar apariencia generica: toolbox agrupado como herramienta de editor, inspector contextual, diagnostics integrados, nodes UML mas tecnicos, AppBar/StatusBar densos y paleta azul/neutra coherente.
- Nueva iteracion visual corrigio que `Technical Canvas / Modeling IDE` seguia siendo demasiado generico. Se actualizo la skill y el editor a `Blueprint Workbench`, recomponiendo la UI con Model Rail, canvas dominante, Tool Dock inferior, Property Sheet, nodos UML blueprint e IDE StatusBar.
- Iteracion correctiva final por prueba manual responsive: el problema real de #004 era que la condicion de montaje confiaba en `ResizeObserver.contentRect`, pero React Flow valida su parent con dimensiones layout reales. Se cambio a lectura de `offsetWidth`/`offsetHeight` del host cuando esta disponible, se mantuvo el host directo absoluto por `inset: 0`, se fijo el viewport global y se simplifico la composicion compacta para que el canvas sea el unico contenido central permanente.
- Iteracion correctiva final de relaciones: `onSelectionChange` de React Flow podia introducir ruido de seleccion durante relation mode. Ahora `onNodeClick` prioriza source/target cuando la herramienta activa es association, aggregation, composition o generalization, ignora enums como endpoints, y solo usa seleccion normal fuera de relation mode. Los tests verifican kind/source/target reales en `ProjectDocument`.
- Segunda correccion estricta de React Flow #004: el parent DOM real de `<ReactFlow />` es `react-flow-host`. La medicion anterior podia montar usando `contentRect` aun cuando `clientWidth/clientHeight` seguian en cero. Ahora `requestAnimationFrame` espera dimensiones reales del host directo antes del mount, y `ResizeObserver` no controla desmontajes posteriores.
- Iteracion diagnostica hydration/breakpoint: MUI `useMediaQuery` se usaba sin `noSsr` en `UmlEditorClient` y `EditorStatusBar`, permitiendo doble render SSR/default -> cliente real. Se cambio a `{ noSsr: true }` y se agrego flag de hydration en `UmlCanvas` para no montar React Flow durante el estado transitorio. La rama DOM del canvas se mantiene unica entre desktop y compacto.
- Correccion SSR/hydration: la opcion `{ noSsr: true }` fue revertida para breakpoints que cambian markup porque provoco server `compact=false` versus first-client `compact=true`. Ahora `UmlEditorClient` calcula `compact = isHydrated ? mediaCompact : false`; `EditorStatusBar` consume el mismo valor y React Flow espera `canMount` desde el editor hidratado.

## Limitaciones

- Editor manual inicial, no una herramienta UML completa tipo Enterprise Architect.
- Demo reiniciable al recargar porque CU-03 aun no implementa persistencia.
- Auto-layout usa tamanos iniciales simples para ELK.
- Crear clase/enum usa posicion por defecto hasta mover o auto-layout.
- Editor manual demo sin persistencia real hasta CU-03.

## Deuda Tecnica

- Evaluar en CUs posteriores si crear elemento + posicion inicial debe ser una unica operacion de historial.
- Mejorar notacion UML grafica avanzada cuando el editor evolucione.
- Revisar posteriormente el warning de accesibilidad/focus de Chrome: `Blocked aria-hidden on an element because its descendant retained focus`, observado al usar Drawer MUI. No bloqueo el funcionamiento validado.
- Agregar o configurar favicon para evitar `favicon.ico` 404. Es deuda visual menor y no bloquea CU-02.

## Resultado Final

CU-02 queda implementado, aceptado por el usuario y archivado tras la iteracion correctiva final de responsive real, React Flow #004, relaciones, readiness estricta del parent DOM directo de React Flow y correccion SSR/hydration del breakpoint estructural. Blueprint Workbench es el diseno final aceptado; desktop conserva Model Rail, canvas dominante, Tool Dock inferior, Property Sheet e IDE StatusBar, y responsive fue validado manualmente con composicion compacta canvas-first. Hydration mismatch, React Flow #004 y el render loop `Maximum update depth exceeded` quedaron corregidos segun la verificacion manual final.

## Commit de Cierre

OpenSpec archivado como `openspec/changes/archive/2026-09-07-cu-02-manual-uml-workspace`. Commit y push pendientes.
