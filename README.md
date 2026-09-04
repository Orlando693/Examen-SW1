# Examen SW1

Herramienta CASE colaborativa y offline-first para modelado UML de clases y generación automática de aplicaciones.

## Estado actual

- Ciclo: **Ciclo 1 — Inicio y base arquitectónica**
- Caso de uso actual: **CU-00 — Base del proyecto**
- Estado: **NOT STARTED / preparación final**
- Roadmap: **4 ciclos / 12 casos de uso / 3 CUs por ciclo**

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
