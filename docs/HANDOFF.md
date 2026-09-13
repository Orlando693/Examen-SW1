# Project Handoff

## CU activo

CU-05 - Colaboracion realtime y presencia. Incremento 1 FUNCTIONAL SCOPE COMPLETE: validacion automatizada y aceptacion manual multi-profile PASS. El conteo permanece 16/19 porque 1.6, 1.8 y 1.13 mezclan dependencias posteriores. Incremento 2 esta READY TO START; no implementa comandos UML realtime durables.

## Trabajo terminado

- CU-04 esta COMPLETE, VERIFIED, MANUALLY ACCEPTED y ARCHIVED en `openspec/changes/archive/2026-09-12-cu-04-auth-ownership-invitations`.
- Entrego auth JWT/Argon2id con `sessionStorage`, ownership/EDITOR authorization, IDOR concealment, authorization-aware CAS y lifecycle seguro de invitaciones email-bound con persistencia hash-only.
- Evidencia: root tests 133 PASS; migration history limpia de cinco migraciones PASS; Chrome manual owner/editor/unrelated/invitations PASS.
- CU-05: Presence frontend, lifecycle del cliente, join buffer bounded con overflow/resync y cursor coalescido estan implementados. La integracion real Socket.IO/PostgreSQL cubre roles, rooms, epoch concurrente, switching, expiry, roster, Presence bidireccional y cleanup offline.
- Aceptacion manual multi-profile CU-05 PASS: sesiones compartidas, roster, cursor bidireccional, pan/zoom, seleccion remota de nodo/relationship, editing/dragging Presence, hidden-tab cleanup, disconnect/reconnect sin duplicados y consolas limpias. RemoteSelectionOverlay usa bounds medidos actuales de React Flow (`useInternalNode`, `positionAbsolute`, `measured`), sin modificar viewport ni seleccion local.

## Pendiente

- Iniciar Incremento 2 con Task 2.1: decoder estricto framework-independent del command envelope y los 19 comandos UML. 1.6/1.8/1.13 permanecen unchecked por matriz/dedupe command de Incremento 2 y resource updates de Incremento 3.
- CU-04 permanece pendiente de commit y push por instruccion explicita del usuario.

## Limitaciones

- Playwright no esta instalado; la evidencia de navegador de CU-04 es manual Chrome suministrada por el usuario.
- Los colaboradores aun ven cambios UML persistidos despues de Manual Save: el gateway/session/presence foundation no implementa comandos UML realtime ni reemplaza Save. CU-05 conserva `baseRevision` y `baseRealtimeVersion` separados de `storageVersion`, session epochs efimeros, presencia sin migracion y un unico proceso.

## Siguiente accion exacta

Implementar Task 2.1 de `cu-05-realtime-collaboration-presence` en un micro-pass separado; mantener persistencia antes de ACK/broadcast como requisito posterior. No archive ni push.
