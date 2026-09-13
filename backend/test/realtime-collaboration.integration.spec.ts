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

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl || testDatabaseUrl === process.env.DATABASE_URL) throw new Error('Realtime integration requires isolated TEST_DATABASE_URL.');

describe('Realtime collaboration authentication', () => {
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
  let app: NestFastifyApplication;
  const sockets: Socket[] = [];
  const emails = new Set<string>();
  const projects = new Set<string>();

  beforeAll(async () => { await prisma.$connect(); });
  afterEach(async () => {
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
  function join(socket: Socket, projectId: string): Promise<CollaborationAck<CollaborationSnapshot>> { return new Promise((resolve, reject) => socket.timeout(2_000).emit('project:join', { projectId }, (error: Error | null, response: CollaborationAck<CollaborationSnapshot>) => error ? reject(error) : resolve(response))); }
  function leave(socket: Socket): Promise<{ ok: true; data: { left: true } }> { return new Promise((resolve, reject) => socket.timeout(2_000).emit('project:leave', (error: Error | null, response: { ok: true; data: { left: true } }) => error ? reject(error) : resolve(response))); }
  function resync(socket: Socket): Promise<CollaborationAck<CollaborationSnapshot>> { return new Promise((resolve, reject) => socket.timeout(2_000).emit('project:resync', (error: Error | null, response: CollaborationAck<CollaborationSnapshot>) => error ? reject(error) : resolve(response))); }
  function presence(socket: Socket, input: unknown): Promise<CollaborationAck<unknown>> { return new Promise((resolve, reject) => socket.timeout(2_000).emit('project:presence', input, (error: Error | null, response: CollaborationAck<unknown>) => error ? reject(error) : resolve(response))); }
  function nextPresence(socket: Socket): Promise<unknown[]> { return new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Presence event timed out')), 2_000); socket.once('project:presence', (roster) => { clearTimeout(timeout); resolve(roster as unknown[]); }); }); }

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

    const ownerRoster = nextPresence(ownerA);
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
    const shortLivedToken = await jwt.signAsync({ sub: account.user.id }, { expiresIn: 1 });
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
