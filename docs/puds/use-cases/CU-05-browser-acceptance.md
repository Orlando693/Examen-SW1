# CU-05 - Protocolo de aceptacion de navegador

## Estado

Las tareas OpenSpec 3.12 y 3.13 estan completas: este protocolo deja una preparacion y registro repetibles para la aceptacion manual obligatoria de CU-05. Las tareas 4.5 y 4.6 requieren evidencia humana de todos sus criterios.

## Decision sobre Playwright

El workspace no contiene `playwright` ni `@playwright/test`, tampoco configuracion de Playwright. No se adopta ni instala como dependencia para este CU: el producto exige aceptacion manual Chrome aun cuando exista automatizacion y el alcance de estas tareas es preparar evidencia, no incorporar infraestructura E2E. `Real browser verification remains pending.`

## Preparacion segura

Requisitos locales:

- Node.js 24 y npm 11.
- PostgreSQL local disponible en la URL de desarrollo elegida. Docker no es requisito.
- Google Chrome o Chromium con tres perfiles aislados: `OWNER`, `EDITOR` y `UNRELATED`. No usar ventanas normales e incognito como sustituto si el navegador comparte datos inesperadamente.

Abra PowerShell en `C:\Orlando693\Examen-SW1` y ejecute lo siguiente. El secreto se genera solo para la sesion actual; no se imprime ni se guarda en archivos.

```powershell
$env:BACKEND_PORT = '3001'
$env:FRONTEND_ORIGIN = 'http://localhost:3000'
$env:NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3001'
$env:NEXT_PUBLIC_REALTIME_URL = 'http://localhost:3001/collaboration'
$env:DATABASE_URL = 'postgresql://examen_sw1@localhost:5432/examen_sw1?schema=public'
$env:JWT_SECRET = -join ((33..126) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
npm ci
npm run db:migrate:deploy --workspace backend
npm run dev
```

Espere que `http://localhost:3001/health` responda y abra `http://localhost:3000` en cada perfil. Si su PostgreSQL no usa la URL mostrada, cambie solo `DATABASE_URL` en la sesion de PowerShell por su URL local. No cree `.env`, no copie secretos a la consola del navegador y no use `TEST_DATABASE_URL` para esta aceptacion.

En los tres perfiles registre, desde la UI, cuentas nuevas y unicas para esta ejecucion. Use por ejemplo `owner.<fecha-hora>@example.test`, `editor.<fecha-hora>@example.test` y `unrelated.<fecha-hora>@example.test`; use contrasenas temporales distintas de al menos ocho caracteres y no las registre en la evidencia. Con OWNER cree desde la UI un proyecto A. Cree tambien un proyecto B desde OWNER: sirve para probar aislamiento y no debe compartirse. Desde A, cree la invitacion para EDITOR, copie el enlace mostrado por la UI y abralo solo en el perfil EDITOR para aceptarlo. Asi las cuentas, proyectos e invitacion nacen durante la ejecucion y no dependen de datos precreados ni de inserciones SQL.

## Escenarios obligatorios

Antes de cada escenario anote hora, perfiles, proyecto y viewport. En DevTools active `Preserve log` en Console y Network, filtre errores y no copie valores `Authorization`, JWT, cookies ni frames que contengan tokens. Un `favicon.ico` 404 aislado es informacion; CORS, hydration, React Flow `#004`, duplicate keys, maximum update depth, excepciones no capturadas y fallos Socket.IO del flujo son bloqueantes.

| ID | Pasos exactos | Resultado esperado |
| --- | --- | --- |
| B1 - Carga y join | Abra A en OWNER y EDITOR. Espere `Saved`. | Ambos ven roster OWNER/EDITOR, con avatar, rol y estado online. No hay error bloqueante en consola o red. |
| B2 - Mutacion y persistencia | En OWNER cree una clase con nombre valido. En EDITOR renombrela, agregue un atributo y muevala. Cree una relacion y actualice su multiplicidad. En cada caso espere `Saving` y luego `Saved`. | Cada cambio llega al otro perfil sin Save ni recarga. El boton de persistencia es estado no accionable; Undo/Redo y sus atajos estan bloqueados durante colaboracion. |
| B3 - Cursor, seleccion, edicion y dos pestanas | En EDITOR seleccione y edite una clase y mueva el puntero sobre el canvas. Abra A en una segunda pestana del mismo perfil EDITOR; cierre una de las dos pestanas. | OWNER ve indicadores remotos sin que su seleccion ni viewport cambien. EDITOR aparece una sola vez en el roster y queda online hasta cerrar la ultima pestana. |
| B4 - No refit y responsive | En OWNER haga pan/zoom y conserve una referencia visual. En EDITOR mueva una clase y ejecute Auto Layout. En OWNER cambie viewport `desktop -> mobile -> tablet -> desktop` usando Device Toolbar. | No hay recentrado ni auto-fit remoto; Fit View solo ocurre por accion explicita. No hay overflow horizontal, el canvas tiene tamano util y los controles primarios siguen accesibles. |
| B5 - Red y recuperacion | Con ambos conectados, en DevTools de EDITOR seleccione Network `Offline`. Intente una mutacion y haga pan, zoom y seleccion. Vuelva a `Online` y espere reconexion; despues haga una mutacion valida. | EDITOR muestra `Disconnected`, no acumula ni publica la mutacion offline, y conserva pan/zoom/seleccion. Tras snapshot autoritativo vuelve a permitir una nueva mutacion, que llega a OWNER sin recarga. |
| B6 - Aislamiento de proyecto y usuario | Copie desde la barra de direcciones de OWNER el `projectId` de B. Abra `/editor?projectId=<id-de-B>` en EDITOR y UNRELATED. Vuelva a A en OWNER/EDITOR. | EDITOR y UNRELATED no ven nombre, documento, roster ni datos de B; el fallo es seguro. Su intento no desconecta ni suscribe indebidamente la sesion de A. |
| B7 - Perdida de acceso por eliminacion | Mantenga EDITOR abierto en A. En OWNER vuelva a la lista y elimine A con la UI. | EDITOR recibe revocacion/desconexion segura y no recibe mas estado del proyecto; volver a abrir A no revela contenido. Esto cubre perdida de acceso por eliminacion de proyecto. |
| B8 - Expiracion real | En una ejecucion nueva, deje una pestana unida durante 60 minutos desde el login, sin modificar `JWT_ACCESS_TOKEN_TTL_SECONDS` (el backend solo admite 3600). Despues espere al menos 10 segundos y provoque una interaccion no destructiva. | La sesion realtime expirada deja de recibir estado protegido, solicita inicio de sesion y no permite mutaciones. Registre hora de login y hora observada; no simule expiracion modificando el reloj ni el token. |

La revocacion de una invitacion pendiente no elimina una membresia EDITOR ya aceptada. La UI no ofrece revocacion de membresia aceptada; por tanto, la perdida pasiva de una membresia individual se demuestra por la integracion determinista existente y no se debe alterar directamente PostgreSQL para fingir evidencia manual. Mantenga ese subcaso como pendiente si se requiere aceptacion manual adicional.

## Evidencia recibida

El usuario suministro la aceptacion final de Chrome: OWNER/EDITOR aislados; join, roster, cursor, seleccion de nodo y relacion, edicion, actividad, crear, renombrar, atributo, mover, `ApplyLayout`, estado de Save, Undo y atajos de teclado, viewport, offline, reconnect, mutacion posterior al reconnect, expiracion real de 60 minutos y mutaciones protegidas: PASS. La confirmacion final tambien cubre creacion de relacion y actualizacion de multiplicidad, arbitraje de dos pestanas del mismo EDITOR con transicion offline al cerrar la ultima, reapertura tras colaboracion durable, ocultamiento de UNRELATED y denegacion de cambio a proyecto no autorizado sin perder la suscripcion valida. Consola sin errores, convergencia PASS y blockers 0.

La evidencia cubre B1-B6 y B8, incluidos los criterios manuales de 4.5 y 4.6. B7 se mantiene como evidencia de integracion y protocolo manual separado, porque la eliminacion del proyecto ya se cubre de forma determinista sin requerir una afirmacion adicional para los criterios de cierre.

## Plantilla de evidencia

Copie esta plantilla por ejecucion y complete solo valores no sensibles:

```text
CU-05 navegador manual
Fecha/hora inicio:
Version/commit local (si existe):
Navegador y version:
Viewports usados (desktop/tablet/mobile):
Base URL frontend/backend:
Datos creados por UI: OWNER/EDITOR/UNRELATED y proyectos A/B (sin emails completos, contrasenas, IDs ni tokens): SI/NO

B1 carga/join: PASS | FAIL | PENDIENTE
B2 mutacion/persistencia: PASS | FAIL | PENDIENTE
B3 presencia/dos pestanas: PASS | FAIL | PENDIENTE
B4 no-refit/responsive: PASS | FAIL | PENDIENTE
B5 red/reconexion: PASS | FAIL | PENDIENTE
B6 aislamiento: PASS | FAIL | PENDIENTE
B7 perdida de acceso por eliminacion: PASS | FAIL | PENDIENTE
B8 expiracion real de 60 minutos: PASS | FAIL | PENDIENTE
Perdida pasiva de membresia aceptada: PENDIENTE (sin UI de revocacion; cubierta por integracion determinista)

Console: sin errores bloqueantes | detalle seguro:
Network/Socket.IO: sin CORS ni fallo no controlado | detalle seguro:
Capturas adjuntas (sin secretos):
Blockers:
Resultado global: PASS | FAIL | PENDIENTE
Aceptacion humana (nombre/fecha):
```

Al terminar, detenga `npm run dev` con `Ctrl+C`. Elimine los proyectos A y B desde la UI si la ejecucion no se conservara. No adjunte capturas de DevTools que muestren encabezados de autorizacion, tokens, enlaces de invitacion completos o datos privados.
