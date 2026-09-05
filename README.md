# Examen SW1

Herramienta CASE colaborativa y offline-first para modelado UML de clases y generación automática de aplicaciones.

## Estado actual

- Ciclo: **Ciclo 1 — Inicio y base arquitectónica**
- Caso de uso actual: **CU-00 — Base del proyecto**
- Estado: **IMPLEMENTED / pendiente de aceptación, verify final, archive, commit y push**
- Roadmap: **4 ciclos / 12 casos de uso / 3 CUs por ciclo**

## Estructura actual

```text
Examen-SW1/
├── frontend/
├── backend/
├── docs/
├── openspec/
├── .opencode/
├── AGENTS.md
├── README.md
├── .gitignore
├── package.json
└── .env.example
```

## Requisitos locales

- Node.js 24 LTS
- npm 11 o superior

## Configuración

Usa `.env.example` como referencia para variables locales:

```text
BACKEND_PORT=3001
FRONTEND_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

No se deben commitear archivos `.env` ni secretos.

## Instalación

Desde la raíz del repositorio:

```powershell
npm install
```

## Desarrollo

Levantar frontend y backend desde la raíz:

```powershell
npm run dev
```

También pueden ejecutarse por separado:

```powershell
npm run dev:backend
npm run dev:frontend
```

Después de `npm run build`, también pueden levantarse los servidores de producción por separado:

```powershell
npm run start:backend
npm run start:frontend
```

URLs locales por defecto:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3001/health`

## Comandos de calidad

Desde la raíz del repositorio:

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
```

Por workspace:

```powershell
npm run test --workspace backend
npm run typecheck --workspace backend
npm run lint --workspace backend
npm run build --workspace backend


npm run test --workspace frontend
npm run typecheck --workspace frontend
npm run lint --workspace frontend
npm run build --workspace frontend
npm run start --workspace frontend
```

## Stack principal

### Aplicación CASE principal

- Next.js App Router + TypeScript
- Material UI
- React Flow (`@xyflow/react`)
- ELK.js
- Zustand
- NestJS 11 + Fastify
- Prisma
- PostgreSQL
- Socket.IO

En CU-00 solo están implementadas las bases Next.js/MUI y NestJS/Fastify con `GET /health`. Prisma, PostgreSQL, Socket.IO y demás capacidades se implementarán en CUs posteriores.

### Aplicaciones generadas

- Backend: Java 21 + Spring Boot 4.x + Gradle + Spring Data JPA + PostgreSQL
- Frontend web: Next.js App Router + Material UI
- Mobile: Flutter + Dart, con Android como objetivo mínimo de demostración

### IA, visión y voz

- Qwen3 1.7B
- node-llama-cpp + Transformers.js
- Florence-2
- Vosk

### Despliegue

- AWS como plataforma obligatoria de despliegue online
- mantenimiento del modo offline-first y colaboración por LAN/hotspot

## Metodología

El proyecto utiliza:

- PUDS;
- OpenSpec;
- OpenCode;
- Git/GitHub.

La implementación se realiza **un caso de uso a la vez** siguiendo:

```text
plan → aprobación → OpenSpec → OpenCode → tests → iteración → documentación → verify → archive → commit/push
```

## Roadmap PUDS

- Ciclo 1: CU-00 a CU-02
- Ciclo 2: CU-03 a CU-05
- Ciclo 3: CU-06 a CU-08
- Ciclo 4: CU-09 a CU-11

## Documentación

- Visión técnica y de producto: `docs/product/product-01-next-nestjs.md`
- Roadmap PUDS: `docs/puds/use-cases/README.md`
- Estado real: `docs/STATUS.md`
- Handoff entre chats/sesiones: `docs/HANDOFF.md`
- Reglas para agentes: `AGENTS.md`
