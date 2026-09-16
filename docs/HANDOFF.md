# Project Handoff

## CU activo

CU-06 - UML -> modelo relacional y backend Spring generado. ACTIVE; Incremento 1 implementado y validado, Incrementos 2/3 no iniciados.

## OpenSpec activo

`cu-06-uml-relational-spring-generator` en `openspec/changes/cu-06-uml-relational-spring-generator/`. Los fixes clean-clone y browser realtime connection siguen archivados; CU-05 sigue archivado.

## Trabajo terminado

- CU-05 esta COMPLETADO, VERIFIED y MANUALLY ACCEPTED. Sus 58 tareas estan completas; la aceptacion Chrome cubrio relacion/multiplicidad, dos pestanas, reapertura, ocultamiento UNRELATED y switch denial, ademas de los criterios ya registrados.
- La verificacion fresca CU-05 paso: 367 pruebas (frontend 172, backend 159, UML core 36), typecheck, lint, builds, Prisma generate/validate/migration test, OpenSpec strict y `git diff --check`.
- El commit de implementacion es `941ca31` (`feat: complete CU-05 realtime collaboration and presence`).
- Fix clean-clone COMPLETADO y archivado: typecheck raiz genera las declaraciones UML core desde `dist` ausente; FK Prisma se verifica por `P2003`; `UmlEditorClient` tiene timeout local de 15 s para renders MUI/jsdom pesados. Validacion raiz 367/367, typecheck/lint/build y Prisma generate/validate/migraciones DEV/TEST PASS; schema/migrations sin cambios. Commit de implementacion `81ec1ff`.
- Fix browser realtime connection CLOSED/ARCHIVED: contrato `NEXT_PUBLIC_REALTIME_URL=http://localhost:3001`; el cliente agrega `/collaboration` una sola vez y expone un error seguro ante handshake fallido. La aceptacion Chrome PASS confirmo Socket.IO, proyecto autorizado y `auth/me`; la causa fue un bundle Next/Turbopack antiguo compilado con el namespace duplicado. Verificacion fresca 371/371 (frontend 176, backend 159, UML core 36), typecheck/lint/build, Prisma generate/validate/migraciones DEV/TEST y OpenSpec strict PASS; blockers 0. Entorno laptop: READY. Commit de implementacion `8c60766`.
- Propuesta CU-06 creada: RelationalModel/RelationalMapper separados de `uml-core`, generador Spring Handlebars separado, tres incrementos exactos y harness Gradle/Java 21. No se implemento codigo ni se instalaron dependencias.
- Incremento 1 implemento `@examen-sw1/relational-core`: contratos relacionales, metadata externa de identifier hints, mapper determinista, diagnosticos fail-closed, nombres SQL, PK/FK/unique/check/indexes, enums, asociaciones, aggregation/composition y JOINED. Validacion fresca PASS: Prisma generate/validate, migrate deploy DEV/TEST (5 sin pendientes), realtime integration 36 PASS, raiz 381/381 (frontend 176, backend 159, core 36, relational 10), typecheck/lint/build, OpenSpec strict y `git diff --check`.
- Incremento 2 implemento `@examen-sw1/spring-generator` con Handlebars 4.7.9. Recibe solamente RelationalModel, genera archivos ordenados/hash manifest, valida package/path, y produce foundation Gradle/Java 21/Spring Boot 4.0.0, wrapper sin JAR falso, entities/enums/JOINED/relations, layers API/application/persistence y config/errors. Validacion completa PASS: raiz 385/385 (spring-generator 4), Prisma DEV/TEST y quality checks. Incremento 3 sigue NOT STARTED; no harness Gradle real, Java compilation generada, archive ni push.

## Limitaciones vigentes

- `npm audit --omit=dev` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas); los fixes disponibles requieren upgrades mayores no aplicados.
- CU-05 mantiene coordinacion realtime de un solo proceso; la coordinacion distribuida queda fuera de alcance hasta CU-11.
- Java 21 no esta verificado: `java --version` y `javac --version` no funcionan en el shell actual. No bloquea Incremento 1; sera requisito antes de verificaciones reales de proyecto generado.

## Siguiente accion exacta

Crear solo el checkpoint commit `feat: add CU-06 Spring generator foundation` sin incluir `frontend/next-env.d.ts`, y detenerse. No iniciar Incremento 3 ni CU-07.
