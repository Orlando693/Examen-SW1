import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { PrismaClient } from '@prisma/client';
import { io, type Socket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.config.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import type { CollaborationAck, CollaborationSnapshot } from '../src/collaboration/contracts.js';
import { CollaborationSessionManager } from '../src/collaboration/collaboration-session.manager.js';
import { ProjectCommandCoordinator } from '../src/collaboration/project-command-coordinator.js';
import { digestProjectDocument } from '../src/collaboration/canonical-digest.js';
import { UmlCommandBus, type ProjectResource } from '@examen-sw1/uml-core';
import type { ProjectCommandApplied } from '../src/collaboration/project-command-applied.js';
import { ProjectsService } from '../src/projects/projects.service.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl || testDatabaseUrl === process.env.DATABASE_URL) throw new Error('Realtime integration requires isolated TEST_DATABASE_URL.');

interface FrontendClient {
  connect(accessToken: string): void;
  joinProject(projectId: string): Promise<CollaborationAck<CollaborationSnapshot>>;
  resync(): Promise<CollaborationAck<CollaborationSnapshot>>;
  subscribe(event: 'connect' | 'project:command-applied', listener: (value: unknown) => void): () => void;
  disconnect(): void;
}
interface FrontendBridge {
  join(projectId: string): Promise<{ ack: CollaborationAck<CollaborationSnapshot>; applied: boolean }>;
  receiveApplied(applied: unknown): Promise<void>;
  readonly session: unknown;
}
type FrontendModules = {
  CollaborationClient: new (socketFactory?: undefined, realtimeUrl?: string) => FrontendClient;
  CollaborationSessionBridge: new (client: { joinProject(projectId: string): Promise<CollaborationAck<CollaborationSnapshot>>; resync(): Promise<CollaborationAck<CollaborationSnapshot>> }, installResource: (resource: ProjectResource) => void) => FrontendBridge;
  isProjectCommandApplied(value: unknown): boolean;
  sha256Canonical(value: unknown): Promise<string>;
};

async function loadFrontendModules(): Promise<FrontendModules> {
  const client = await import(new URL('../../frontend/lib/collaboration/collaboration-client.ts', import.meta.url).href) as Pick<FrontendModules, 'CollaborationClient'>;
  const bridge = await import(new URL('../../frontend/lib/collaboration/collaboration-session-bridge.ts', import.meta.url).href) as Pick<FrontendModules, 'CollaborationSessionBridge'>;
  const applied = await import(new URL('../../frontend/lib/collaboration/project-command-applied.ts', import.meta.url).href) as Pick<FrontendModules, 'isProjectCommandApplied'>;
  const digest = await import(new URL('../../frontend/lib/collaboration/canonical-digest.ts', import.meta.url).href) as Pick<FrontendModules, 'sha256Canonical'>;
  return { ...client, ...bridge, ...applied, ...digest };
}

describe('Realtime collaboration authentication', () => {
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
  let app: NestFastifyApplication;
  const sockets: Socket[] = [];
  const frontendClients: FrontendClient[] = [];
  const emails = new Set<string>();
  const projects = new Set<string>();

  beforeAll(async () => { await prisma.$connect(); });
  afterEach(async () => {
    frontendClients.forEach((client) => client.disconnect()); frontendClients.length = 0;
    sockets.forEach((socket) => socket.disconnect()); sockets.length = 0;
    await app?.close();
    await prisma.project.deleteMany({ where: { id: { in: [...projects] } } }); projects.clear();
    await prisma.user.deleteMany({ where: { email: { in: [...emails] } } });
    emails.clear();
  });
  afterAll(async () => { await prisma.$disconnect(); });

  async function start() {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureApplication(app); app.useWebSocketAdapter(new IoAdapter(app));
    await app.init(); await app.getHttpAdapter().getInstance().ready(); await app.listen(0, '127.0.0.1');
    const email = `rt-${randomUUID()}@example.com`; emails.add(email);
    const account = (await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password-with-eight-characters' })).body;
    const address = app.getHttpServer().address(); if (!address || typeof address === 'string') throw new Error('No TCP address');
    return { account, url: `http://127.0.0.1:${address.port}`, jwt: app.get(JwtService) };
  }
  async function connect(url: string, token: string) {
    const socket = io(`${url}/collaboration`, { auth: { token }, transports: ['websocket'], reconnection: false }); sockets.push(socket);
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    expect(socket.connected).toBe(true); return socket;
  }
  function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; }); return { promise, resolve }; }
  function replacementDocument(name: string) {
    return { revision: 1, model: { packages: [], classes: [{ id: `class-${name}`, name, attributes: [], operations: [] }], enumerations: [], relationships: [] }, layout: { nodes: [] } };
  }
  function waitForClientEvent(client: FrontendClient, event: 'connect' | 'project:command-applied'): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { unsubscribe(); reject(new Error(`${event} timed out`)); }, 2_000);
      const unsubscribe = client.subscribe(event, (value) => { clearTimeout(timeout); unsubscribe(); resolve(value); });
    });
  }
  function join(socket: Socket, projectId: string): Promise<CollaborationAck<CollaborationSnapshot>> { return new Promise((resolve, reject) => socket.timeout(2_000).emit('project:join', { projectId }, (error: Error | null, response: CollaborationAck<CollaborationSnapshot>) => error ? reject(error) : resolve(response))); }
  function leave(socket: Socket): Promise<{ ok: true; data: { left: true } }> { return new Promise((resolve, reject) => socket.timeout(2_000).emit('project:leave', (error: Error | null, response: { ok: true; data: { left: true } }) => error ? reject(error) : resolve(response))); }
  function resync(socket: Socket): Promise<CollaborationAck<CollaborationSnapshot>> { return new Promise((resolve, reject) => socket.timeout(2_000).emit('project:resync', (error: Error | null, response: CollaborationAck<CollaborationSnapshot>) => error ? reject(error) : resolve(response))); }
  function presence(socket: Socket, input: unknown): Promise<CollaborationAck<unknown>> { return new Promise((resolve, reject) => socket.timeout(2_000).emit('project:presence', input, (error: Error | null, response: CollaborationAck<unknown>) => error ? reject(error) : resolve(response))); }
  function command(socket: Socket, input: unknown): Promise<unknown> { return new Promise((resolve, reject) => socket.timeout(2_000).emit('project:command', input, (error: Error | null, response: unknown) => error ? reject(error) : resolve(response))); }

  it('enforces the command-rate boundary on the real Socket.IO transport', async () => {
    const { account, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${account.accessToken}`).send({ name: 'Command transport limit' }).expect(201)).body.project;
    projects.add(project.id);
    const socket = await connect(url, account.accessToken);
    expect((await join(socket, project.id)).ok).toBe(true);
    for (let index = 0; index < 10; index += 1) expect(await command(socket, {})).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
    expect(await command(socket, {})).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
  });
  function nextPresence(socket: Socket, matches: (roster: unknown[]) => boolean = () => true): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { socket.off('project:presence', listener); reject(new Error('Presence event timed out')); }, 2_000);
      const listener = (roster: unknown) => { if (Array.isArray(roster) && matches(roster)) { clearTimeout(timeout); socket.off('project:presence', listener); resolve(roster); } };
      socket.on('project:presence', listener);
    });
  }
  function nextResourceUpdated(socket: Socket): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { socket.off('project:resource-updated', listener); reject(new Error('Resource update timed out')); }, 2_000);
      const listener = (update: unknown) => { clearTimeout(timeout); socket.off('project:resource-updated', listener); resolve(update); };
      socket.on('project:resource-updated', listener);
    });
  }
  async function executeCommand(socket: Socket, owner: { user: { id: string; email: string } }, joined: CollaborationSnapshot, commandId = randomUUID(), name = 'RealtimeClass') {
    return app.get(ProjectCommandCoordinator).execute({
      socketId: socket.id ?? '',
      user: owner.user,
      expiresAt: Date.now() + 60_000,
      activeProjectId: joined.projectId,
      activeSessionId: joined.sessionId,
      envelope: { projectId: joined.projectId, sessionId: joined.sessionId, commandId, baseRealtimeVersion: joined.realtimeVersion, baseRevision: joined.resource.project.revision, command: { type: 'CreateClass', name } },
    });
  }

  it('keeps an authenticated collaboration socket connected', async () => {
    const { account, url } = await start(); await connect(url, account.accessToken);
  });

  it('acknowledges owner join and hides unrelated projects', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Realtime' }).expect(201)).body.project; projects.add(project.id);
    const ownerAck = await join(await connect(url, owner.accessToken), project.id);
    expect(ownerAck.ok).toBe(true);
    if (!ownerAck.ok) throw new Error(ownerAck.error.code);
    expect(ownerAck.data.projectId).toBe(project.id); expect(ownerAck.data.accessLevel).toBe('OWNER'); expect(ownerAck.data.sessionId).toMatch(/^[0-9a-f-]{36}$/i); expect(ownerAck.data.realtimeVersion).toBe(0);
    const email = `rt-${randomUUID()}@example.com`; emails.add(email);
    const unrelated = (await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password-with-eight-characters' })).body;
    const unrelatedAck = await join(await connect(url, unrelated.accessToken), project.id);
    expect(unrelatedAck).toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_FOUND' } });
  });

  it('allows an editor membership and denies a pending invitation', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Realtime' }).expect(201)).body.project; projects.add(project.id);
    const ownerAck = await join(await connect(url, owner.accessToken), project.id); expect(ownerAck.ok).toBe(true);
    const editorEmail = `rt-${randomUUID()}@example.com`; emails.add(editorEmail);
    const editor = (await request(app.getHttpServer()).post('/auth/register').send({ email: editorEmail, password: 'password-with-eight-characters' })).body;
    await prisma.projectMembership.create({ data: { projectId: project.id, userId: editor.user.id } });
    const editorAck = await join(await connect(url, editor.accessToken), project.id);
    expect(editorAck.ok).toBe(true);
    if (!editorAck.ok) throw new Error(editorAck.error.code);
    expect(editorAck.data.accessLevel).toBe('EDITOR');
    expect(editorAck.data.participants.filter((participant) => participant.userId === owner.user.id)).toHaveLength(1);
    expect(editorAck.data.participants.filter((participant) => participant.userId === editor.user.id)).toHaveLength(1);
    expect(editorAck.data.participants).toHaveLength(2);
    expect(editorAck.data.participants.every((participant) => participant.online)).toBe(true);
    const pendingEmail = `rt-${randomUUID()}@example.com`; emails.add(pendingEmail);
    const pending = (await request(app.getHttpServer()).post('/auth/register').send({ email: pendingEmail, password: 'password-with-eight-characters' })).body;
    await prisma.projectInvitation.create({ data: { projectId: project.id, inviterId: owner.user.id, invitedEmail: pendingEmail, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } });
    const pendingAck = await join(await connect(url, pending.accessToken), project.id);
    expect(pendingAck).toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_FOUND' } });
  });

  it('deduplicates one user across two joined sockets in the public roster', async () => {
    const { account, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${account.accessToken}`).send({ name: 'Multi-tab' }).expect(201)).body.project; projects.add(project.id);
    const first = await join(await connect(url, account.accessToken), project.id); expect(first.ok).toBe(true);
    const second = await join(await connect(url, account.accessToken), project.id); expect(second.ok).toBe(true);
    if (!second.ok) throw new Error(second.error.code);
    expect(second.data.participants.filter((participant) => participant.userId === account.user.id)).toHaveLength(1);
    expect(second.data.participants).toHaveLength(1); expect(second.data.realtimeVersion).toBe(0);
  });

  it('shares one initial session between concurrent owner and editor joins', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Concurrent' }).expect(201)).body.project; projects.add(project.id);
    const email = `rt-${randomUUID()}@example.com`; emails.add(email);
    const editor = (await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password-with-eight-characters' })).body;
    await prisma.projectMembership.create({ data: { projectId: project.id, userId: editor.user.id } });
    const [ownerSocket, editorSocket] = await Promise.all([connect(url, owner.accessToken), connect(url, editor.accessToken)]);
    const [ownerAck, editorAck] = await Promise.all([join(ownerSocket, project.id), join(editorSocket, project.id)]);
    expect(ownerAck.ok).toBe(true); expect(editorAck.ok).toBe(true);
    if (!ownerAck.ok || !editorAck.ok) throw new Error('Concurrent join rejected');
    expect(ownerAck.data.accessLevel).toBe('OWNER'); expect(editorAck.data.accessLevel).toBe('EDITOR');
    expect(ownerAck.data.sessionId).toBe(editorAck.data.sessionId); expect(ownerAck.data.realtimeVersion).toBe(0); expect(editorAck.data.realtimeVersion).toBe(0);
    expect(app.get(CollaborationSessionManager).get(project.id)?.sessionId).toBe(ownerAck.data.sessionId);
  });

  it('broadcasts editor presence only within its project and clears it on disconnect', async () => {
    const { account: owner, url } = await start();
    const create = async (name: string) => {
      const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name }).expect(201)).body.project;
      projects.add(project.id);
      return project;
    };
    const [projectA, projectB] = await Promise.all([create('Presence A'), create('Presence B')]);
    const editorEmail = `rt-${randomUUID()}@example.com`; emails.add(editorEmail);
    const editor = (await request(app.getHttpServer()).post('/auth/register').send({ email: editorEmail, password: 'password-with-eight-characters' })).body;
    await prisma.projectMembership.create({ data: { projectId: projectA.id, userId: editor.user.id } });
    const [ownerA, ownerB, editorSocket] = await Promise.all([connect(url, owner.accessToken), connect(url, owner.accessToken), connect(url, editor.accessToken)]);
    await Promise.all([join(ownerA, projectA.id), join(ownerB, projectB.id), join(editorSocket, projectA.id)]);

    const ownerRoster = nextPresence(ownerA, (roster) => roster.some((participant) => typeof participant === 'object' && participant !== null && 'cursor' in participant && (participant as { cursor: unknown }).cursor !== null));
    const isolatedEvents: unknown[] = [];
    ownerB.on('project:presence', (roster) => isolatedEvents.push(roster));
    const published = await presence(editorSocket, { cursor: { x: 25, y: 50 }, selectionIds: ['class-1'], editingElementId: 'class-1', activity: 'editing' });
    expect(published.ok).toBe(true);
    const roster = await ownerRoster as Array<{ userId: string; cursor: { x: number; y: number } | null; selectionIds: string[]; editingElementId: string | null; activity: string | null }>;
    expect(roster).toEqual(expect.arrayContaining([expect.objectContaining({ userId: editor.user.id, cursor: { x: 25, y: 50 }, selectionIds: ['class-1'], editingElementId: 'class-1', activity: 'editing' })]));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(isolatedEvents).toEqual([]);

    const offlineRoster = nextPresence(ownerA);
    editorSocket.disconnect();
    const afterDisconnect = await offlineRoster as Array<{ userId: string; online: boolean }>;
    expect(afterDisconnect).toEqual(expect.arrayContaining([expect.objectContaining({ userId: editor.user.id, online: false })]));
  });

  it('cleans project tracking on leave followed by disconnect', async () => {
    const { account, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${account.accessToken}`).send({ name: 'Leave' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, account.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const sessions = app.get(CollaborationSessionManager); expect(sessions.get(project.id)?.socketIds.size).toBe(1);
    expect(await leave(socket)).toEqual({ ok: true, data: { left: true } });
    expect(sessions.get(project.id)?.socketIds.size).toBe(0); expect(sessions.get(project.id)?.realtimeVersion).toBe(0);
    socket.disconnect(); expect(sessions.get(project.id)?.socketIds.size).toBe(0);
  });

  it('returns the current authoritative snapshot without changing the session', async () => {
    const { account, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${account.accessToken}`).send({ name: 'Resync' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, account.accessToken); const joined = await join(socket, project.id); const inactive = await connect(url, account.accessToken);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const synced = await resync(socket); expect(synced.ok).toBe(true); if (!synced.ok) throw new Error(synced.error.code);
    expect(synced.data.projectId).toBe(project.id); expect(synced.data.sessionId).toBe(joined.data.sessionId); expect(synced.data.realtimeVersion).toBe(joined.data.realtimeVersion); expect(synced.data.resource.project.id).toBe(project.id);
    expect(await resync(inactive)).toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_JOINED' } });
  });

  it('switches projects and leaves no stale subscription after a denied switch', async () => {
    const { account, url } = await start();
    const create = async (name: string) => { const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${account.accessToken}`).send({ name }).expect(201)).body.project; projects.add(project.id); return project; };
    const [projectA, projectB] = await Promise.all([create('A'), create('B')]); const socket = await connect(url, account.accessToken); const sessions = app.get(CollaborationSessionManager);
    const joinedA = await join(socket, projectA.id); expect(joinedA.ok).toBe(true); if (!joinedA.ok) throw new Error(joinedA.error.code);
    const joinedB = await join(socket, projectB.id); expect(joinedB.ok).toBe(true); if (!joinedB.ok) throw new Error(joinedB.error.code);
    expect(sessions.get(projectA.id)?.socketIds.size).toBe(0); expect(sessions.get(projectB.id)?.socketIds.size).toBe(1); expect(joinedA.data.sessionId).not.toBe(joinedB.data.sessionId);
    const forbidden = await prisma.project.create({ data: { name: 'Forbidden', ownerId: null, revision: 0, model: projectA.model, layout: projectA.layout } }); projects.add(forbidden.id);
    const denied = await join(socket, forbidden.id); expect(denied).toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_FOUND' } });
    expect(sessions.get(projectB.id)?.socketIds.size).toBe(0); expect(sessions.get(forbidden.id)).toBeUndefined();
    const rejoined = await join(socket, projectA.id); expect(rejoined.ok).toBe(true); expect(sessions.get(projectA.id)?.socketIds.size).toBe(1);
  });

  it('cleans the active project when a connected JWT expires', async () => {
    const { account, url, jwt } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${account.accessToken}`).send({ name: 'Expiry' }).expect(201)).body.project; projects.add(project.id);
    const shortLivedToken = await jwt.signAsync({ sub: account.user.id }, { expiresIn: 2 });
    const socket = await connect(url, shortLivedToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); const sessions = app.get(CollaborationSessionManager); expect(sessions.get(project.id)?.socketIds.size).toBe(1);
    await new Promise<void>((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('JWT expiry disconnect timed out')), 3_000); socket.once('disconnect', () => { clearTimeout(timeout); resolve(); }); });
    expect(sessions.get(project.id)?.socketIds.size).toBe(0); expect(socket.connected).toBe(false);
  });

  it('rejects missing and invalid socket tokens before connection', async () => {
    const { url } = await start();
    for (const token of [undefined, 'invalid-token']) {
      const candidate = io(`${url}/collaboration`, { auth: token === undefined ? {} : { token }, transports: ['websocket'], reconnection: false }); sockets.push(candidate);
      await new Promise<void>((resolve, reject) => { candidate.once('connect_error', () => resolve()); candidate.once('connect', () => reject(new Error('Unauthenticated socket connected'))); });
      expect(candidate.connected).toBe(false);
    }
  });

  it('conceals ownerless projects from authenticated users', async () => {
    const { account, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${account.accessToken}`).send({ name: 'Ownerless' }).expect(201)).body.project;
    projects.add(project.id); await prisma.project.update({ where: { id: project.id }, data: { ownerId: null } });
    const response = await join(await connect(url, account.accessToken), project.id);
    expect(response).toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_FOUND' } });
  });

  it('returns a safe schema-incompatible join acknowledgement without document version leakage', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Unsupported schema' }).expect(201)).body.project;
    projects.add(project.id);
    await prisma.project.update({ where: { id: project.id }, data: { documentSchemaVersion: 999 } });

    const response = await join(await connect(url, owner.accessToken), project.id);
    expect(response).toEqual({ ok: false, error: { code: 'SCHEMA_INCOMPATIBLE', message: 'The project document is incompatible.' }, action: 'RESYNC' });
    expect(JSON.stringify(response)).not.toContain('999');
    expect(JSON.stringify(response)).not.toMatch(/stack|prisma|sql|jwt|token/i);
  });

  it('rejects a correctly signed expired token before connection', async () => {
    const { account, url, jwt } = await start();
    const expired = await jwt.signAsync({ sub: account.user.id }, { expiresIn: -1 });
    const candidate = io(`${url}/collaboration`, { auth: { token: expired }, transports: ['websocket'], reconnection: false }); sockets.push(candidate);
    await new Promise<void>((resolve, reject) => { candidate.once('connect_error', () => resolve()); candidate.once('connect', () => reject(new Error('Expired socket connected'))); });
    expect(candidate.connected).toBe(false);
  });

  it('rejects a token whose user no longer exists', async () => {
    const { account, url } = await start();
    await prisma.user.delete({ where: { id: account.user.id } }); emails.delete(account.user.email);
    const candidate = io(`${url}/collaboration`, { auth: { token: account.accessToken }, transports: ['websocket'], reconnection: false }); sockets.push(candidate);
    await new Promise<void>((resolve, reject) => { candidate.once('connect_error', () => resolve()); candidate.once('connect', () => reject(new Error('Deleted user connected'))); });
    expect(candidate.connected).toBe(false);
  });

  it('persists one normalized command and returns an idempotent duplicate before stale checks', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Commands' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, owner.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const commandId = randomUUID();
    const applied = await executeCommand(socket, owner, joined.data, commandId);
    expect(applied).toMatchObject({ ok: true, status: 'APPLIED', data: { resultingRealtimeVersion: 1, resultingRevision: 1, storageVersion: 1 } });
    if (!applied.ok) throw new Error('Command rejected');
    expect(applied.data.normalizedCommand).toMatchObject({ type: 'CreateClass', classId: expect.any(String) });
    const duplicate = await executeCommand(socket, owner, joined.data, commandId);
    expect(duplicate).toEqual({ ok: true, status: 'DUPLICATE', data: applied.data });
    const mismatch = await executeCommand(socket, owner, joined.data, commandId, 'Different');
    expect(mismatch).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
    const row = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(row.revision).toBe(1); expect(row.storageVersion).toBe(1);
  });

  it('acknowledges the sender, broadcasts once to collaborators, and does not rebroadcast a duplicate', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Command delivery' }).expect(201)).body.project; projects.add(project.id);
    const editorEmail = `rt-${randomUUID()}@example.com`; emails.add(editorEmail);
    const editor = (await request(app.getHttpServer()).post('/auth/register').send({ email: editorEmail, password: 'password-with-eight-characters' })).body;
    await prisma.projectMembership.create({ data: { projectId: project.id, userId: editor.user.id } });
    const ownerSocket = await connect(url, owner.accessToken); const editorSocket = await connect(url, editor.accessToken);
    const ownerJoin = await join(ownerSocket, project.id); const editorJoin = await join(editorSocket, project.id);
    expect(ownerJoin.ok).toBe(true); expect(editorJoin.ok).toBe(true);
    if (!ownerJoin.ok) throw new Error(ownerJoin.error.code);
    const commandId = randomUUID();
    const payload = { projectId: project.id, sessionId: ownerJoin.data.sessionId, commandId, baseRealtimeVersion: ownerJoin.data.realtimeVersion, baseRevision: ownerJoin.data.resource.project.revision, command: { type: 'CreateClass', name: 'Delivered' } };
    let collaboratorEvents = 0;
    const appliedEvent = new Promise<unknown>((resolve) => editorSocket.once('project:command-applied', (event) => { collaboratorEvents += 1; resolve(event); }));
    const senderEvents: unknown[] = []; ownerSocket.on('project:command-applied', (event) => senderEvents.push(event));
    const applied = await command(ownerSocket, payload);
    expect(applied).toMatchObject({ ok: true, status: 'APPLIED' });
    expect(await appliedEvent).toMatchObject({ commandId, resultingRealtimeVersion: 1 });
    expect(senderEvents).toEqual([]);
    const duplicate = await command(ownerSocket, payload);
    expect(duplicate).toEqual({ ...(applied as object), status: 'DUPLICATE' });
    expect(collaboratorEvents).toBe(1);
    expect(senderEvents).toEqual([]);
  });

  it('propagates all 19 normalized command types between owner and editor with durable canonical convergence', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'All commands' }).expect(201)).body.project; projects.add(project.id);
    const editorEmail = `rt-${randomUUID()}@example.com`; emails.add(editorEmail);
    const editor = (await request(app.getHttpServer()).post('/auth/register').send({ email: editorEmail, password: 'password-with-eight-characters' })).body;
    await prisma.projectMembership.create({ data: { projectId: project.id, userId: editor.user.id } });
    const ownerSocket = await connect(url, owner.accessToken); const editorSocket = await connect(url, editor.accessToken);
    const ownerJoin = await join(ownerSocket, project.id); const editorJoin = await join(editorSocket, project.id);
    expect(ownerJoin.ok).toBe(true); expect(editorJoin.ok).toBe(true);
    if (!ownerJoin.ok || !editorJoin.ok) throw new Error('Join rejected');

    let realtimeVersion = 0; let revision = 0; let resultingDocumentDigest = ownerJoin.data.documentDigest;
    let ownerDocument = ownerJoin.data.resource.project; let editorDocument = editorJoin.data.resource.project;
    const apply = (document: typeof ownerDocument, applied: ProjectCommandApplied) => {
      const result = new UmlCommandBus().execute(document, applied.normalizedCommand, { now: applied.appliedAt });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Authoritative command failed locally');
      return result.document;
    };
    const submit = async (sender: Socket, recipient: Socket, umlCommand: unknown): Promise<ProjectCommandApplied> => {
      const broadcast = new Promise<ProjectCommandApplied>((resolve) => recipient.once('project:command-applied', (event) => resolve(event as ProjectCommandApplied)));
      const response = await command(sender, { projectId: project.id, sessionId: ownerJoin.data.sessionId, commandId: randomUUID(), baseRealtimeVersion: realtimeVersion, baseRevision: revision, command: umlCommand });
      expect(response).toMatchObject({ ok: true, status: 'APPLIED' });
      const applied = (response as { ok: true; status: 'APPLIED'; data: ProjectCommandApplied }).data;
      expect(await broadcast).toEqual(applied);
      ownerDocument = apply(ownerDocument, applied); editorDocument = apply(editorDocument, applied);
      realtimeVersion = applied.resultingRealtimeVersion; revision = applied.resultingRevision; resultingDocumentDigest = applied.resultingDocumentDigest;
      return applied;
    };

    const classA = (await submit(ownerSocket, editorSocket, { type: 'CreateClass', name: 'Customer' })).normalizedCommand as { classId: string };
    const classB = (await submit(editorSocket, ownerSocket, { type: 'CreateClass', name: 'Order' })).normalizedCommand as { classId: string };
    await submit(ownerSocket, editorSocket, { type: 'RenameClass', classId: classA.classId, name: 'Client' });
    const attribute = (await submit(editorSocket, ownerSocket, { type: 'AddAttribute', classId: classA.classId, name: 'name', attributeType: { kind: 'primitive', name: 'string' } })).normalizedCommand as { attributeId: string };
    await submit(ownerSocket, editorSocket, { type: 'UpdateAttribute', classId: classA.classId, attributeId: attribute.attributeId, name: 'fullName' });
    await submit(editorSocket, ownerSocket, { type: 'RemoveAttribute', classId: classA.classId, attributeId: attribute.attributeId });
    const enumeration = (await submit(ownerSocket, editorSocket, { type: 'CreateEnumeration', name: 'Status' })).normalizedCommand as { enumerationId: string };
    await submit(editorSocket, ownerSocket, { type: 'RenameEnumeration', enumerationId: enumeration.enumerationId, name: 'OrderStatus' });
    const literal = (await submit(ownerSocket, editorSocket, { type: 'AddEnumerationLiteral', enumerationId: enumeration.enumerationId, name: 'OPEN' })).normalizedCommand as { literalId: string };
    await submit(editorSocket, ownerSocket, { type: 'UpdateEnumerationLiteral', enumerationId: enumeration.enumerationId, literalId: literal.literalId, name: 'ACTIVE' });
    await submit(ownerSocket, editorSocket, { type: 'RemoveEnumerationLiteral', enumerationId: enumeration.enumerationId, literalId: literal.literalId });
    const association = (await submit(editorSocket, ownerSocket, { type: 'CreateAssociation', sourceClassId: classA.classId, targetClassId: classB.classId, name: 'places' })).normalizedCommand as { relationshipId: string };
    await submit(ownerSocket, editorSocket, { type: 'UpdateMultiplicity', relationshipId: association.relationshipId, endpoint: 'target', multiplicity: { lower: 0, upper: '*' } });
    await submit(editorSocket, ownerSocket, { type: 'UpdateRelationship', relationshipId: association.relationshipId, name: 'creates', sourceMultiplicity: { lower: 1, upper: 1 }, targetMultiplicity: null });
    await submit(ownerSocket, editorSocket, { type: 'DeleteRelationship', relationshipId: association.relationshipId });
    const generalization = (await submit(editorSocket, ownerSocket, { type: 'CreateGeneralization', sourceClassId: classA.classId, targetClassId: classB.classId })).normalizedCommand as { relationshipId: string };
    await submit(ownerSocket, editorSocket, { type: 'DeleteRelationship', relationshipId: generalization.relationshipId });
    await submit(editorSocket, ownerSocket, { type: 'MoveNode', elementId: classA.classId, position: { x: 20, y: 30 } });
    await submit(ownerSocket, editorSocket, { type: 'ApplyLayout', updates: [{ elementId: classA.classId, position: { x: 100, y: 120 } }, { elementId: classB.classId, position: { x: 400, y: 120 } }] });
    await submit(editorSocket, ownerSocket, { type: 'DeleteEnumeration', enumerationId: enumeration.enumerationId });
    await submit(ownerSocket, editorSocket, { type: 'DeleteClass', classId: classA.classId });

    const persisted = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(ownerDocument).toEqual(editorDocument);
    expect(ownerDocument).toMatchObject({ revision, model: { classes: [expect.objectContaining({ id: classB.classId })], enumerations: [], relationships: [] } });
    expect(digestProjectDocument(ownerDocument)).toBe(resultingDocumentDigest);
    expect(persisted.revision).toBe(revision); expect(persisted.storageVersion).toBe(realtimeVersion);
  });

  it('rejects validation, deleted-target edits, rename/delete and same-field same-base conflicts without advancing state', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Conflict commands' }).expect(201)).body.project; projects.add(project.id);
    const editorEmail = `rt-${randomUUID()}@example.com`; emails.add(editorEmail);
    const editor = (await request(app.getHttpServer()).post('/auth/register').send({ email: editorEmail, password: 'password-with-eight-characters' })).body;
    await prisma.projectMembership.create({ data: { projectId: project.id, userId: editor.user.id } });
    const ownerSocket = await connect(url, owner.accessToken); const editorSocket = await connect(url, editor.accessToken);
    const ownerJoin = await join(ownerSocket, project.id); const editorJoin = await join(editorSocket, project.id);
    expect(ownerJoin.ok).toBe(true); expect(editorJoin.ok).toBe(true);
    if (!ownerJoin.ok || !editorJoin.ok) throw new Error('Join rejected');
    const envelope = (commandValue: unknown, baseRealtimeVersion: number, baseRevision: number) => ({ projectId: project.id, sessionId: ownerJoin.data.sessionId, commandId: randomUUID(), baseRealtimeVersion, baseRevision, command: commandValue });
    const created = await command(ownerSocket, envelope({ type: 'CreateClass', name: 'Customer' }, 0, 0)) as { ok: true; data: ProjectCommandApplied };
    expect(created).toMatchObject({ ok: true, status: 'APPLIED' });
    const classId = created.data.normalizedCommand as { classId: string };
    const validation = await command(editorSocket, envelope({ type: 'RenameClass', classId: classId.classId, name: '' }, 1, 1));
    expect(validation).toMatchObject({ ok: false, error: { code: 'SEMANTIC_VALIDATION_FAILED' }, action: 'NONE' });
    const renamed = await command(ownerSocket, envelope({ type: 'RenameClass', classId: classId.classId, name: 'Client' }, 1, 1));
    expect(renamed).toMatchObject({ ok: true, status: 'APPLIED' });
    const renameDeleteConflict = await command(editorSocket, envelope({ type: 'DeleteClass', classId: classId.classId }, 1, 1));
    expect(renameDeleteConflict).toMatchObject({ ok: false, error: { code: 'STALE_REALTIME_VERSION' }, action: 'RESYNC' });
    const sameFieldConflict = await command(editorSocket, envelope({ type: 'RenameClass', classId: classId.classId, name: 'Other' }, 1, 1));
    expect(sameFieldConflict).toMatchObject({ ok: false, error: { code: 'STALE_REALTIME_VERSION' }, action: 'RESYNC' });
    const deleted = await command(editorSocket, envelope({ type: 'DeleteClass', classId: classId.classId }, 2, 2));
    expect(deleted).toMatchObject({ ok: true, status: 'APPLIED' });
    const deletedEdit = await command(ownerSocket, envelope({ type: 'RenameClass', classId: classId.classId, name: 'Gone' }, 3, 3));
    expect(deletedEdit).toMatchObject({ ok: false, error: { code: 'DOMAIN_COMMAND_REJECTED' }, action: 'NONE' });
    const persisted = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(persisted).toMatchObject({ revision: 3, storageVersion: 3 });
  });

  it('keeps version domains separate across commands, duplicates, rejections, resync and presence', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Version domains' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, owner.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    expect(joined.data).toMatchObject({ realtimeVersion: 0, resource: { storageVersion: 0, documentSchemaVersion: 1, project: { revision: 0 } } });
    const commandId = randomUUID(); const input = { projectId: project.id, sessionId: joined.data.sessionId, commandId, baseRealtimeVersion: 0, baseRevision: 0, command: { type: 'CreateClass', name: 'Versioned' } };
    const applied = await command(socket, input) as { ok: true; status: 'APPLIED'; data: ProjectCommandApplied };
    expect(applied).toMatchObject({ ok: true, status: 'APPLIED', data: { resultingRealtimeVersion: 1, resultingRevision: 1, storageVersion: 1 } });
    expect(await command(socket, input)).toEqual({ ok: true, status: 'DUPLICATE', data: applied.data });
    expect(await command(socket, { ...input, commandId: randomUUID(), baseRealtimeVersion: 0 })).toMatchObject({ ok: false, error: { code: 'STALE_REALTIME_VERSION' } });
    expect(await command(socket, { ...input, commandId: randomUUID(), baseRealtimeVersion: 1, baseRevision: 0 })).toMatchObject({ ok: false, error: { code: 'STALE_DOCUMENT_REVISION' } });
    expect((await presence(socket, { cursor: { x: 1, y: 2 }, selectionIds: [], editingElementId: null, activity: 'selecting' })).ok).toBe(true);
    const synced = await resync(socket); expect(synced.ok).toBe(true); if (!synced.ok) throw new Error(synced.error.code);
    expect(synced.data).toMatchObject({ sessionId: joined.data.sessionId, realtimeVersion: 1, resource: { storageVersion: 1, documentSchemaVersion: 1, project: { revision: 1 } } });
  });

  it('persists before APPLIED and recovers durable state after an epoch replacement', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Recovery' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, owner.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const coordinator = app.get(ProjectCommandCoordinator); let observedCommit = false;
    coordinator.setPostCasHookForTest(async () => {
      const row = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
      observedCommit = row.revision === 1 && row.storageVersion === 1;
    });
    const input = { projectId: project.id, sessionId: joined.data.sessionId, commandId: randomUUID(), baseRealtimeVersion: 0, baseRevision: 0, command: { type: 'CreateClass', name: 'Durable' } };
    const applied = await command(socket, input);
    coordinator.setPostCasHookForTest(null);
    expect(observedCommit).toBe(true); expect(applied).toMatchObject({ ok: true, status: 'APPLIED', data: { storageVersion: 1, resultingRevision: 1, resultingRealtimeVersion: 1 } });
    app.get(CollaborationSessionManager).invalidate(project.id, joined.data.sessionId);
    expect(await command(socket, input)).toMatchObject({ ok: false, error: { code: 'STALE_SESSION' }, action: 'RESYNC' });
    const reopened = await resync(socket); expect(reopened.ok).toBe(true); if (!reopened.ok) throw new Error(reopened.error.code);
    expect(reopened.data).toMatchObject({ resource: { storageVersion: 1, documentSchemaVersion: 1, project: { revision: 1, model: { classes: [expect.objectContaining({ name: 'Durable' })] } } }, realtimeVersion: 0 });
    expect(reopened.data.sessionId).not.toBe(joined.data.sessionId);
  });

  it('buffers a real applied event until the frontend installs the earlier join snapshot, then replays it once', async () => {
    const { CollaborationClient, CollaborationSessionBridge, isProjectCommandApplied, sha256Canonical } = await loadFrontendModules();
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Frontend join delivery' }).expect(201)).body.project; projects.add(project.id);
    const editorEmail = `rt-${randomUUID()}@example.com`; emails.add(editorEmail);
    const editor = (await request(app.getHttpServer()).post('/auth/register').send({ email: editorEmail, password: 'password-with-eight-characters' })).body;
    await prisma.projectMembership.create({ data: { projectId: project.id, userId: editor.user.id } });
    const ownerSocket = await connect(url, owner.accessToken);
    const ownerJoin = await join(ownerSocket, project.id);
    expect(ownerJoin.ok).toBe(true);
    if (!ownerJoin.ok) throw new Error(ownerJoin.error.code);

    const snapshotCaptured = deferred<void>();
    const releaseJoinAck = deferred<void>();
    const client = new CollaborationClient(undefined, url); frontendClients.push(client);
    const delayedClient = {
      async joinProject(projectId: string) {
        const ack = await client.joinProject(projectId);
        snapshotCaptured.resolve();
        await releaseJoinAck.promise;
        return ack;
      },
      resync: () => client.resync(),
    };
    const installed: ProjectResource[] = [];
    const bridge = new CollaborationSessionBridge(delayedClient, (resource) => installed.push(structuredClone(resource)));
    let deliveredEvents = 0;
    const delivered = waitForClientEvent(client, 'project:command-applied');
    const unsubscribeApplied = client.subscribe('project:command-applied', (value) => {
      deliveredEvents += 1;
      if (isProjectCommandApplied(value)) void bridge.receiveApplied(value);
    });
    const connected = waitForClientEvent(client, 'connect');
    client.connect(editor.accessToken);
    await connected;

    const joining = bridge.join(project.id);
    await snapshotCaptured.promise;
    const commandId = randomUUID();
    const commandAck = await command(ownerSocket, { projectId: project.id, sessionId: ownerJoin.data.sessionId, commandId, baseRealtimeVersion: ownerJoin.data.realtimeVersion, baseRevision: ownerJoin.data.resource.project.revision, command: { type: 'CreateClass', name: 'Delivered during join' } });
    expect(commandAck).toMatchObject({ ok: true, status: 'APPLIED', data: { commandId, resultingRealtimeVersion: 1, resultingRevision: 1, storageVersion: 1 } });
    await delivered;
    expect(deliveredEvents).toBe(1);
    expect(installed).toEqual([]);

    releaseJoinAck.resolve();
    await expect(joining).resolves.toMatchObject({ applied: true });
    unsubscribeApplied();

    const applied = (commandAck as { ok: true; status: 'APPLIED'; data: { resultingDocumentDigest: string } }).data;
    expect(installed).toHaveLength(2);
    expect(installed[0]).toMatchObject({ project: { revision: 0, model: { classes: [] } }, storageVersion: 0 });
    expect(installed[1]).toMatchObject({ project: { revision: 1, model: { classes: [expect.objectContaining({ name: 'Delivered during join' })] } }, storageVersion: 1 });
    await expect(sha256Canonical(installed[1]!.project)).resolves.toBe(applied.resultingDocumentDigest);
    expect(bridge.session).toMatchObject({ projectId: project.id, sessionId: ownerJoin.data.sessionId, realtimeVersion: 1, revision: 1, storageVersion: 1, documentDigest: applied.resultingDocumentDigest });
  });

  it('retries exactly once after a metadata-only CAS conflict using a deterministic barrier', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'CAS retry' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, owner.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const coordinator = app.get(ProjectCommandCoordinator); let changed = false;
    coordinator.setBeforeCasHookForTest(async () => {
      if (!changed) { changed = true; await prisma.project.update({ where: { id: project.id }, data: { name: 'Metadata only', storageVersion: { increment: 1 } } }); }
    });
    const result = await executeCommand(socket, owner, joined.data);
    coordinator.setBeforeCasHookForTest(null);
    expect(result).toMatchObject({ ok: true, status: 'APPLIED', data: { storageVersion: 2, resultingRevision: 1 } });
    expect(changed).toBe(true);
  });

  it('serializes PATCH, emits its exact durable snapshot to current participants, and preserves revision and realtime version', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Metadata event' }).expect(201)).body.project; projects.add(project.id);
    const editorEmail = `rt-${randomUUID()}@example.com`; emails.add(editorEmail);
    const editor = (await request(app.getHttpServer()).post('/auth/register').send({ email: editorEmail, password: 'password-with-eight-characters' })).body;
    await prisma.projectMembership.create({ data: { projectId: project.id, userId: editor.user.id } });
    const ownerSocket = await connect(url, owner.accessToken); const editorSocket = await connect(url, editor.accessToken);
    const ownerJoin = await join(ownerSocket, project.id); const editorJoin = await join(editorSocket, project.id);
    expect(ownerJoin.ok).toBe(true); expect(editorJoin.ok).toBe(true);
    if (!ownerJoin.ok || !editorJoin.ok) throw new Error('Join rejected');
    const ownerUpdate = nextResourceUpdated(ownerSocket); const editorUpdate = nextResourceUpdated(editorSocket);
    const patch = await request(app.getHttpServer()).patch(`/projects/${project.id}`).set('Authorization', `Bearer ${owner.accessToken}`).send({ baseStorageVersion: 0, name: 'Renamed metadata' }).expect(200);
    const [ownerEvent, editorEvent] = await Promise.all([ownerUpdate, editorUpdate]);
    expect(ownerEvent).toEqual(editorEvent);
    expect(ownerEvent).toMatchObject({ projectId: project.id, sessionId: ownerJoin.data.sessionId, documentDigest: expect.any(String), resource: patch.body });
    expect(patch.body).toMatchObject({ storageVersion: 1, project: { revision: 0, metadata: { name: 'Renamed metadata' } } });
    expect(app.get(CollaborationSessionManager).get(project.id)).toMatchObject({ sessionId: ownerJoin.data.sessionId, realtimeVersion: 0 });
    const persisted = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(persisted).toMatchObject({ storageVersion: 1, revision: 0, name: 'Renamed metadata' });
  });

  it('orders PATCH before a queued command so the command persists after the metadata-only storage change', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'PATCH before command' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, owner.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const enteredPatch = deferred<void>(); const releasePatch = deferred<void>();
    const projectService = app.get(ProjectsService);
    projectService.setBeforeMetadataSaveHookForTest(async () => { enteredPatch.resolve(); await releasePatch.promise; });
    const pendingPatch = request(app.getHttpServer()).patch(`/projects/${project.id}`).set('Authorization', `Bearer ${owner.accessToken}`).send({ baseStorageVersion: 0, description: 'metadata first' }).then((response) => response);
    await enteredPatch.promise;
    const pendingCommand = command(socket, { projectId: project.id, sessionId: joined.data.sessionId, commandId: randomUUID(), baseRealtimeVersion: 0, baseRevision: 0, command: { type: 'CreateClass', name: 'AfterPatch' } });
    releasePatch.resolve();
    await expect(pendingPatch).resolves.toMatchObject({ status: 200, body: { storageVersion: 1, project: { revision: 0, metadata: { description: 'metadata first' } } } });
    await expect(pendingCommand).resolves.toMatchObject({ ok: true, status: 'APPLIED', data: { resultingRealtimeVersion: 1, resultingRevision: 1, storageVersion: 2 } });
    projectService.setBeforeMetadataSaveHookForTest(null);
  });

  it('filters resource updates when access is lost before emission', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Protected metadata' }).expect(201)).body.project; projects.add(project.id);
    const editorEmail = `rt-${randomUUID()}@example.com`; emails.add(editorEmail);
    const editor = (await request(app.getHttpServer()).post('/auth/register').send({ email: editorEmail, password: 'password-with-eight-characters' })).body;
    await prisma.projectMembership.create({ data: { projectId: project.id, userId: editor.user.id } });
    const ownerSocket = await connect(url, owner.accessToken); const editorSocket = await connect(url, editor.accessToken);
    await join(ownerSocket, project.id); await join(editorSocket, project.id);
    const received: unknown[] = []; editorSocket.on('project:resource-updated', (event) => received.push(event));
    await prisma.projectMembership.deleteMany({ where: { projectId: project.id, userId: editor.user.id } });
    await request(app.getHttpServer()).patch(`/projects/${project.id}`).set('Authorization', `Bearer ${owner.accessToken}`).send({ baseStorageVersion: 0, name: 'No editor delivery' }).expect(200);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(received).toEqual([]);
    expect(editorSocket.connected).toBe(false);
  });

  it('orders a realtime command before a competing HTTP document replacement and preserves the PUT CAS conflict', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Command before PUT' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, owner.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const enteredCommandCas = deferred<void>(); const releaseCommandCas = deferred<void>();
    const commands = app.get(ProjectCommandCoordinator);
    commands.setBeforeCasHookForTest(async () => { enteredCommandCas.resolve(); await releaseCommandCas.promise; });
    const pendingCommand = command(socket, { projectId: project.id, sessionId: joined.data.sessionId, commandId: randomUUID(), baseRealtimeVersion: 0, baseRevision: 0, command: { type: 'CreateClass', name: 'CommandWins' } });
    await enteredCommandCas.promise;
    const pendingPut = request(app.getHttpServer()).put(`/projects/${project.id}/document`).set('Authorization', `Bearer ${owner.accessToken}`).send({ baseStorageVersion: 0, document: replacementDocument('ReplacementLoses') }).then((response) => response);
    releaseCommandCas.resolve();
    await expect(pendingCommand).resolves.toMatchObject({ ok: true, status: 'APPLIED', data: { resultingRevision: 1, storageVersion: 1 } });
    await expect(pendingPut).resolves.toMatchObject({ status: 409, body: { error: { code: 'PROJECT_REVISION_CONFLICT' } } });
    commands.setBeforeCasHookForTest(null);
    expect(app.get(CollaborationSessionManager).get(project.id)?.sessionId).toBe(joined.data.sessionId);
  });

  it('orders an HTTP document replacement before a queued realtime command, invalidates its epoch, and requires resync', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'PUT before command' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, owner.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const enteredPut = deferred<void>(); const releasePut = deferred<void>();
    const projectService = app.get(ProjectsService);
    projectService.setBeforeDocumentSaveHookForTest(async () => { enteredPut.resolve(); await releasePut.promise; });
    const pendingPut = request(app.getHttpServer()).put(`/projects/${project.id}/document`).set('Authorization', `Bearer ${owner.accessToken}`).send({ baseStorageVersion: 0, document: replacementDocument('ReplacementWins') }).then((response) => response);
    await enteredPut.promise;
    const pendingCommand = command(socket, { projectId: project.id, sessionId: joined.data.sessionId, commandId: randomUUID(), baseRealtimeVersion: 0, baseRevision: 0, command: { type: 'CreateClass', name: 'StaleCommand' } });
    releasePut.resolve();
    await expect(pendingPut).resolves.toMatchObject({ status: 200, body: { storageVersion: 1, project: { revision: 1, model: { classes: [expect.objectContaining({ name: 'ReplacementWins' })] } } } });
    await expect(pendingCommand).resolves.toMatchObject({ ok: false, error: { code: 'STALE_SESSION' }, action: 'RESYNC' });
    projectService.setBeforeDocumentSaveHookForTest(null);
    expect(app.get(CollaborationSessionManager).get(project.id)).toBeUndefined();
    const recovered = await resync(socket);
    expect(recovered.ok).toBe(true); if (!recovered.ok) throw new Error(recovered.error.code);
    expect(recovered.data.sessionId).not.toBe(joined.data.sessionId);
    expect(recovered.data.resource).toMatchObject({ storageVersion: 1, project: { revision: 1, model: { classes: [expect.objectContaining({ name: 'ReplacementWins' })] } } });
  });

  it('orders a realtime command before DELETE and preserves the owner CAS conflict', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Command before DELETE' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, owner.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const enteredCommandCas = deferred<void>(); const releaseCommandCas = deferred<void>();
    const commands = app.get(ProjectCommandCoordinator);
    commands.setBeforeCasHookForTest(async () => { enteredCommandCas.resolve(); await releaseCommandCas.promise; });
    const pendingCommand = command(socket, { projectId: project.id, sessionId: joined.data.sessionId, commandId: randomUUID(), baseRealtimeVersion: 0, baseRevision: 0, command: { type: 'CreateClass', name: 'CommandWins' } });
    await enteredCommandCas.promise;
    const pendingDelete = request(app.getHttpServer()).delete(`/projects/${project.id}`).set('Authorization', `Bearer ${owner.accessToken}`).query({ baseStorageVersion: 0 }).then((response) => response);
    releaseCommandCas.resolve();
    await expect(pendingCommand).resolves.toMatchObject({ ok: true, status: 'APPLIED', data: { resultingRevision: 1, storageVersion: 1 } });
    await expect(pendingDelete).resolves.toMatchObject({ status: 409, body: { error: { code: 'PROJECT_REVISION_CONFLICT' } } });
    commands.setBeforeCasHookForTest(null);
    expect(await prisma.project.findUnique({ where: { id: project.id } })).toMatchObject({ revision: 1, storageVersion: 1 });
    expect(app.get(CollaborationSessionManager).get(project.id)?.sessionId).toBe(joined.data.sessionId);
  });

  it('orders DELETE before a queued command, cleans terminal collaboration state, and conceals the project', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'DELETE before command' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, owner.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const enteredDelete = deferred<void>(); const releaseDelete = deferred<void>();
    const projectService = app.get(ProjectsService);
    projectService.setBeforeDeleteHookForTest(async () => { enteredDelete.resolve(); await releaseDelete.promise; });
    const disconnected = new Promise<void>((resolve) => socket.once('disconnect', () => resolve()));
    const pendingDelete = request(app.getHttpServer()).delete(`/projects/${project.id}`).set('Authorization', `Bearer ${owner.accessToken}`).query({ baseStorageVersion: 0 }).then((response) => response);
    await enteredDelete.promise;
    const socketId = socket.id; if (!socketId) throw new Error('Connected socket is missing an id.');
    const pendingCommand = app.get(ProjectCommandCoordinator).execute({ socketId, user: owner.user, expiresAt: Date.now() + 60_000, activeProjectId: project.id, activeSessionId: joined.data.sessionId, envelope: { projectId: project.id, sessionId: joined.data.sessionId, commandId: randomUUID(), baseRealtimeVersion: 0, baseRevision: 0, command: { type: 'CreateClass', name: 'DeletedProject' } } });
    releaseDelete.resolve();
    await expect(pendingDelete).resolves.toMatchObject({ status: 204 });
    await disconnected;
    await expect(pendingCommand).resolves.toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_FOUND' }, action: 'LEAVE' });
    projectService.setBeforeDeleteHookForTest(null);
    expect(app.get(CollaborationSessionManager).get(project.id)).toBeUndefined();
    expect(await prisma.project.findUnique({ where: { id: project.id } })).toBeNull();
    await request(app.getHttpServer()).get(`/projects/${project.id}`).set('Authorization', `Bearer ${owner.accessToken}`).expect(404).expect(({ body }) => expect(body).toMatchObject({ error: { code: 'PROJECT_NOT_FOUND' } }));
    const laterSocket = await connect(url, owner.accessToken);
    await expect(join(laterSocket, project.id)).resolves.toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_FOUND' } });
  });

  it('invalidates the epoch rather than retrying a canonical CAS conflict', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Canonical conflict' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, owner.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const coordinator = app.get(ProjectCommandCoordinator); let changed = false;
    coordinator.setBeforeCasHookForTest(async () => {
      if (!changed) { changed = true; await prisma.project.update({ where: { id: project.id }, data: { revision: { increment: 1 }, storageVersion: { increment: 1 } } }); }
    });
    const result = await executeCommand(socket, owner, joined.data);
    coordinator.setBeforeCasHookForTest(null);
    expect(result).toMatchObject({ ok: false, error: { code: 'CAS_CONFLICT' }, action: 'RESYNC' });
    expect(changed).toBe(true);
    expect(await executeCommand(socket, owner, joined.data)).toMatchObject({ ok: false, error: { code: 'STALE_SESSION' } });
  });

  it('invalidates the epoch after the bounded metadata retry is exhausted', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Retry exhausted' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, owner.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const coordinator = app.get(ProjectCommandCoordinator); let conflicts = 0;
    coordinator.setBeforeCasHookForTest(async () => {
      conflicts += 1;
      await prisma.project.update({ where: { id: project.id }, data: { storageVersion: { increment: 1 } } });
    });
    const result = await executeCommand(socket, owner, joined.data);
    coordinator.setBeforeCasHookForTest(null);
    expect(result).toMatchObject({ ok: false, error: { code: 'CAS_CONFLICT' }, action: 'RESYNC' });
    expect(conflicts).toBe(2);
    expect(await executeCommand(socket, owner, joined.data)).toMatchObject({ ok: false, error: { code: 'STALE_SESSION' } });
  });

  it('conceals project deletion that occurs at the CAS barrier', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Deleted at CAS' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, owner.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const coordinator = app.get(ProjectCommandCoordinator); let deleted = false;
    coordinator.setBeforeCasHookForTest(async () => {
      if (!deleted) { deleted = true; await prisma.project.delete({ where: { id: project.id } }); projects.delete(project.id); }
    });
    const result = await executeCommand(socket, owner, joined.data);
    coordinator.setBeforeCasHookForTest(null);
    expect(result).toMatchObject({ ok: false, error: { code: 'PROJECT_NOT_FOUND' }, action: 'LEAVE' });
    expect(deleted).toBe(true);
  });

  it('poisons the old epoch after a post-CAS fault without rolling back PostgreSQL', async () => {
    const { account: owner, url } = await start();
    const project = (await request(app.getHttpServer()).post('/projects').set('Authorization', `Bearer ${owner.accessToken}`).send({ name: 'Poison' }).expect(201)).body.project; projects.add(project.id);
    const socket = await connect(url, owner.accessToken); const joined = await join(socket, project.id);
    expect(joined.ok).toBe(true); if (!joined.ok) throw new Error(joined.error.code);
    const coordinator = app.get(ProjectCommandCoordinator); coordinator.setPostCasHookForTest(() => { throw new Error('post-CAS fault'); });
    const uncertain = await executeCommand(socket, owner, joined.data);
    coordinator.setPostCasHookForTest(null);
    expect(uncertain).toMatchObject({ ok: false, error: { code: 'INTERNAL_STATE_UNCERTAIN' }, action: 'RESYNC' });
    const persisted = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(persisted.revision).toBe(1); expect(persisted.storageVersion).toBe(1);
    expect(await executeCommand(socket, owner, joined.data)).toMatchObject({ ok: false, error: { code: 'STALE_SESSION' } });
    const recovered = await resync(socket); expect(recovered.ok).toBe(true); if (!recovered.ok) throw new Error(recovered.error.code);
    expect(recovered.data.sessionId).not.toBe(joined.data.sessionId); expect(recovered.data.resource.project.revision).toBe(1);
  });

  it('allows configured origins and rejects other origins without leaking tokens', async () => {
    const { account, url, jwt } = await start();
    const allowed = io(`${url}/collaboration`, { auth: { token: account.accessToken }, transports: ['websocket'], reconnection: false, extraHeaders: { Origin: 'http://localhost:3000' } }); sockets.push(allowed);
    await new Promise<void>((resolve, reject) => { allowed.once('connect', resolve); allowed.once('connect_error', reject); });
    const expired = await jwt.signAsync({ sub: account.user.id }, { expiresIn: -1 });
    const rejected = io(`${url}/collaboration`, { auth: { token: expired }, transports: ['websocket'], reconnection: false, extraHeaders: { Origin: 'https://denied.example' } }); sockets.push(rejected);
    const error = await new Promise<Error>((resolve, reject) => { rejected.once('connect_error', resolve); rejected.once('connect', () => reject(new Error('Disallowed origin connected'))); });
    const publicError = `${error.name}:${error.message}`;
    for (const forbidden of [expired, process.env.JWT_SECRET ?? '', 'passwordHash', 'Authorization', 'Prisma', 'SELECT ']) if (forbidden) expect(publicError).not.toContain(forbidden);
    expect(rejected.connected).toBe(false);
  });
});
