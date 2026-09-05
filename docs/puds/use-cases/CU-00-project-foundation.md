# CU-00 — Base del proyecto

## Objetivo

Crear la base ejecutable de la aplicación CASE principal y demostrar una comunicación mínima frontend → backend.

## Alcance

- Monorepo con npm workspaces desde la raíz.
- `frontend/` en la raíz con Next.js App Router, TypeScript, Material UI, Vitest y React Testing Library.
- `backend/` en la raíz con NestJS 11, Fastify, TypeScript, Vitest, `@nestjs/testing` y Supertest.
- Endpoint backend `GET /health`.
- UI frontend que consulta el health endpoint y muestra `API disponible` o `API no disponible`.
- Variables documentadas en `.env.example`.
- Scripts raíz para desarrollo, test, typecheck, lint y build.
- Documentación operativa en `README.md`, `docs/STATUS.md` y `docs/HANDOFF.md`.

## Dependencias

- Node.js 24 LTS.
- npm 11 o superior.
- Dependencias npm declaradas en los workspaces `frontend` y `backend`.

## Decisiones Técnicas

- Se usaron npm workspaces nativos para evitar Turborepo, Nx u otra herramienta adicional de monorepo.
- Se respetaron las carpetas raíz `frontend/` y `backend/`; no se crearon `apps/web` ni `apps/api`.
- El backend usa NestJS con `FastifyAdapter` desde el arranque inicial.
- El health check devuelve una respuesta mínima `{ "status": "ok" }` sin fijar un contrato operativo complejo.
- La URL consumida por el frontend se configura con `NEXT_PUBLIC_API_BASE_URL`.
- CORS local se configura con `FRONTEND_ORIGIN`, con valor por defecto `http://localhost:3000`.
- No se incorporaron Prisma, PostgreSQL, autenticación, Socket.IO, React Flow, Zustand ni funcionalidades UML en este CU.

## Estructura Creada

```text
frontend/
├── app/
├── components/
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package.json
├── tsconfig.json
├── tsconfig.typecheck.json
├── vitest.config.ts
└── vitest.setup.ts

backend/
├── src/
├── eslint.config.js
├── package.json
├── tsconfig.build.json
├── tsconfig.json
└── vitest.config.ts
```

## Comandos Importantes

Desde la raíz:

```powershell
npm install
npm run dev
npm run start:backend
npm run start:frontend
npm run test
npm run typecheck
npm run lint
npm run build
```

Por workspace:

```powershell
npm run dev:backend
npm run dev:frontend
npm run test --workspace backend
npm run test --workspace frontend
```

## Implementación Realizada

- Se creó `package.json` raíz con workspaces `frontend` y `backend`.
- Se creó `.env.example` con `BACKEND_PORT`, `FRONTEND_ORIGIN` y `NEXT_PUBLIC_API_BASE_URL`.
- Se actualizó `.gitignore` para dependencias, builds, coverage, logs y entornos locales.
- Se creó script raíz `scripts/dev.mjs` para levantar frontend y backend en desarrollo sin herramientas extra.
- Se creó backend NestJS 11 sobre Fastify con `GET /health`.
- Se creó frontend Next.js App Router con Material UI y un componente `HealthStatus`.
- Se agregaron pruebas backend para `/health` y pruebas frontend para estados disponible/no disponible.
- Se agregó `frontend/tsconfig.typecheck.json` para mantener estable el typecheck independiente, porque Next.js 16 actualiza `tsconfig.json` durante `next build` con tipos generados bajo `.next`.

## Pruebas Automatizadas

- Backend: Vitest + `@nestjs/testing` + Supertest verifica `GET /health` con HTTP 200 y `{ status: "ok" }`.
- Frontend: Vitest + React Testing Library verifica `API disponible` cuando `fetch` responde correctamente y `API no disponible` cuando falla.
- OpenSpec: `openspec validate "cu-00-project-foundation" --strict` finalizó correctamente y `openspec doctor` reportó el root OpenSpec en estado ok.

## Pruebas Manuales

Verificación asistida realizada durante la implementación:

- `npm run dev:backend` arrancó correctamente NestJS/Fastify y mapeó `GET /health`.
- `npm run dev:frontend` arrancó correctamente Next.js y sirvió `http://localhost:3000`.
- Con servidores temporales, `http://localhost:3001/health` respondió HTTP 200 con `{ "status": "ok" }` y `http://localhost:3000` respondió HTTP 200.
- Con servidores de producción construidos, la página renderizó `API disponible` con backend activo y `API no disponible` después de detener el backend.

Pasos de aceptación manual visual recomendados para el usuario:

1. Ejecutar `npm run dev:backend` desde la raíz.
2. Ejecutar `npm run dev:frontend` desde otra terminal en la raíz.
3. Abrir `http://localhost:3000` y comprobar `API disponible`.
4. Detener el backend, recargar el frontend y comprobar `API no disponible`.

## Errores Encontrados

- La primera ejecución de `npm install` excedió el timeout de 120 segundos; se repitió con timeout mayor y finalizó correctamente.
- El typecheck backend falló inicialmente porque `vitest.config.ts` quedaba fuera de `rootDir`; se ajustó `tsconfig.build.json` para limitar `rootDir` solo al build.
- El lint backend detectó un import no usado en el test; se eliminó.
- El lint frontend falló con `FlatCompat` y `eslint-config-next`; se reemplazó por una configuración ESLint plana con `@eslint/js` y `typescript-eslint`.
- Después de `next build`, Next.js agregó tipos generados bajo `.next` a `frontend/tsconfig.json`, lo que podía romper `npm run typecheck` si esos artefactos quedaban incompletos o se limpiaban; se creó `tsconfig.typecheck.json` para excluir `.next` del typecheck independiente.
- El comando `openspec verify` no existe en la versión instalada del CLI; se usaron `openspec validate --strict`, `openspec status` y `openspec doctor` como verificaciones OpenSpec disponibles antes de aceptación.
- La verificación detectó `frontend/tsconfig.tsbuildinfo` y `frontend/tsconfig.typecheck.tsbuildinfo` como artefactos incrementales no ignorados.

## Correcciones

- Se ajustó la configuración TypeScript del backend.
- Se simplificó el lint frontend para usar ESLint plano compatible con la versión instalada.
- Se agregó `@mui/material-nextjs` porque el layout usa `AppRouterCacheProvider` para MUI con App Router.
- Se separó el typecheck frontend en `tsconfig.typecheck.json`, excluyendo `.next` y `*.tsbuildinfo` como artefactos generados.
- Se agregó `*.tsbuildinfo` a `.gitignore` y se eliminaron del working tree los artefactos incrementales generados por TypeScript.

## Limitaciones Conocidas

- El health check solo indica disponibilidad básica de la API; no valida base de datos ni dependencias externas porque no existen en CU-00.
- No hay E2E con Playwright en CU-00; los estados de UI están cubiertos por pruebas de componente y por verificación manual asistida con servidores locales.
- `npm audit` reporta 2 vulnerabilidades moderadas en dependencias transitivas; no se aplicó `npm audit fix --force` porque podría introducir cambios mayores no aprobados.

## Deuda Técnica

- Evaluar reglas de lint más específicas de Next.js cuando el frontend crezca y exista una necesidad concreta.
- Agregar E2E con Playwright en el CU correspondiente.

## Resultado Final

La base ejecutable del proyecto quedó implementada con monorepo npm, frontend Next.js/MUI, backend NestJS/Fastify, endpoint `/health`, integración frontend → backend configurable y pruebas base.

## OpenSpec

Archivado como `openspec/changes/archive/2026-09-04-cu-00-project-foundation`.

## Commit de Cierre

Pendiente. El usuario solicitó no hacer commit ni push todavía.
