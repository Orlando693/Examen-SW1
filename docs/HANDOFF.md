# Project Handoff

## CU activo

CU-07 - Contratos, Domain Manifest y frontend web generado. ACTIVE; Incremento 1 completado y validado. Incrementos 2/3 no iniciados.

## OpenSpec activo

`cu-07-contracts-domain-manifest-generated-frontend` en `openspec/changes/cu-07-contracts-domain-manifest-generated-frontend/`.

## Trabajo terminado

- CU-06 esta CLOSED/ARCHIVED como `2026-09-16-cu-06-uml-relational-spring-generator`; `506079f` esta sincronizado con `origin/main`.
- CU-06 entrega mapping determinista, backend Spring generado, Java 21/Gradle Wrapper test/build, navegacion N:M bidireccional y coverage E2E de aggregation.
- Incremento 1 creo `@examen-sw1/generated-api-contracts`: harness Spring real/H2 temporal, extraccion de `/v3/api-docs`, validacion fail-closed y Postman v2.1 determinista derivado exclusivamente de OpenAPI.
- El backend generado ahora documenta sus respuestas CRUD 201/204/400/404 con springdoc; H2 queda runtime-only para el harness aislado, sin cambio de reglas relacionales.
- La evidencia fresca es 393/393 pruebas (frontend 176, backend 159, contracts 5, relational 10, spring generator 7, UML core 36), typecheck/lint/build, Prisma generate/validate/migrate deploy DEV/TEST y OpenSpec strict PASS.

## Trabajo pendiente

- Esperar aprobacion explicita antes de iniciar Incremento 2, Domain Manifest.
- No crear `frontend-generator` ni iniciar CU-08.

## Limitaciones vigentes

- `npm audit --omit=dev` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas); sus fixes exigen upgrades mayores no aprobados.
- La coordinacion realtime es de un solo proceso hasta CU-11.
- `frontend/next-env.d.ts` conserva un cambio generado por Next fuera de este trabajo de propuesta.

## Siguiente accion exacta

Revisar y aceptar el checkpoint del Incremento 1; despues solicitar aplicar solo Incremento 2 si se aprueba.
