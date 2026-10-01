# Project Handoff

## Estado actual

CU-09 esta VERIFIED, aceptado formalmente y archivado como `2026-09-30-cu-09-voice-flutter-generated-app`. Flutter permanece diferido antes de implementacion. El fix post-archive CU-07 esta VERIFIED, aceptado y archivado como `2026-10-01-fix-cu-07-generated-frontend-from-spring-contract`.

## Trabajo terminado

- Las pruebas seriales de cierre CU-09 pasaron: local-stt 19/19, benchmark 7/7, backend voice 5/5 y frontend voice/AssistantPanel 11/11; typecheck, lint y build relevantes PASS.
- Los gates manuales de voz y benchmark real estan documentados como PASS en `docs/puds/use-cases/CU-09-voice-flutter-generated-app.md`.
- Se creo el OpenSpec del fix CU-07 con propuesta, diseño, delta specs y tareas. La ruta definida usa el Spring temporal generado para extraer el OpenAPI validado, deriva el Domain Manifest y reutiliza `frontend-generator`; no requiere un servidor Spring iniciado por el usuario.
- Diagnostico y correccion automatica del fix CU-07: el 422 no era OpenAPI, DomainManifest ni una race. El backend resolvia `@examen-sw1/frontend-generator` desde `dist` desactualizado, que aun rechazaba `.env.example` como `UNSTABLE_FILE_PLAN`; reconstruir el workspace aplica la ordenacion determinista actual. Endpoint focal PASS, integracion Spring 8/8 PASS y CORS determinista con `FRONTEND_ORIGIN` restaurado despues de cada test.
- Gate manual final CU-07 PASS: backend Spring ZIP y frontend Next.js ZIP descargados desde CASE; Spring generado conecto PostgreSQL en `localhost:8080`; frontend generado con `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080` integro correctamente. Un CORS inicial se debio a que Next uso `3001` por ocupacion de `3000`; al liberar `3000`, CORS y CRUD funcionaron correctamente.

## Limitaciones vigentes

- `npm audit --omit=dev` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas); sus fixes exigen upgrades mayores no aprobados.
- Los hashes publicados de upstream para el modelo Vosk no estan disponibles; el archive SHA-256 permanece `null`. Los JSON y WAV externos no estan en Git.
- Por excepcion autorizada, `fix-cu-06-many-to-many-association-entity` queda pendiente (17/20) y `cu-10-xmi-enterprise-architect-interoperability` queda diferido (0/18). No se deben cerrar como parte del fix CU-07.
- No quedan gates manuales pendientes para el fix CU-07. Verify, archive y aceptacion formal del usuario completados; falta commit y push.

## Siguiente accion exacta

Crear el commit y push del fix archivado CU-07 excluyendo `frontend/next-env.d.ts`. No reabrir CU-09 ni cerrar CU-06/CU-10.
