# Project Handoff

## CU activo

Ninguno. CU-06 - UML -> modelo relacional y backend Spring generado. No iniciado.

## OpenSpec activo

Ninguno. Los fixes clean-clone y browser realtime connection estan archivados como `openspec/changes/archive/2026-09-14-fix-clean-clone-validation` y `openspec/changes/archive/2026-09-15-fix-browser-realtime-connection`; CU-05 sigue archivado como `openspec/changes/archive/2026-09-13-cu-05-realtime-collaboration-presence`.

## Trabajo terminado

- CU-05 esta COMPLETADO, VERIFIED y MANUALLY ACCEPTED. Sus 58 tareas estan completas; la aceptacion Chrome cubrio relacion/multiplicidad, dos pestanas, reapertura, ocultamiento UNRELATED y switch denial, ademas de los criterios ya registrados.
- La verificacion fresca CU-05 paso: 367 pruebas (frontend 172, backend 159, UML core 36), typecheck, lint, builds, Prisma generate/validate/migration test, OpenSpec strict y `git diff --check`.
- El commit de implementacion es `941ca31` (`feat: complete CU-05 realtime collaboration and presence`).
- Fix clean-clone COMPLETADO y archivado: typecheck raiz genera las declaraciones UML core desde `dist` ausente; FK Prisma se verifica por `P2003`; `UmlEditorClient` tiene timeout local de 15 s para renders MUI/jsdom pesados. Validacion raiz 367/367, typecheck/lint/build y Prisma generate/validate/migraciones DEV/TEST PASS; schema/migrations sin cambios. Commit de implementacion `81ec1ff`.
- Fix browser realtime connection CLOSED/ARCHIVED: contrato `NEXT_PUBLIC_REALTIME_URL=http://localhost:3001`; el cliente agrega `/collaboration` una sola vez y expone un error seguro ante handshake fallido. La aceptacion Chrome PASS confirmo Socket.IO, proyecto autorizado y `auth/me`; la causa fue un bundle Next/Turbopack antiguo compilado con el namespace duplicado. Verificacion fresca 371/371 (frontend 176, backend 159, UML core 36), typecheck/lint/build, Prisma generate/validate/migraciones DEV/TEST y OpenSpec strict PASS; blockers 0. Entorno laptop: READY. Commit de implementacion `8c60766`.

## Limitaciones vigentes

- `npm audit --omit=dev` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas); los fixes disponibles requieren upgrades mayores no aplicados.
- CU-05 mantiene coordinacion realtime de un solo proceso; la coordinacion distribuida queda fuera de alcance hasta CU-11.

## Siguiente accion exacta

Preparar el plan de CU-06 y solicitar aprobacion; no iniciar CU-06 ni crear su OpenSpec antes de esa aprobacion.
