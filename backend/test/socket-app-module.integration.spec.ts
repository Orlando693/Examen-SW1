import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { io, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.config.js';

@WebSocketGateway({ namespace: '/diag-app' })
class AppDiagnosticGateway {
  @SubscribeMessage('ping')
  ping(@MessageBody() body: unknown) { return { ok: true, echo: body }; }
}
@Module({ providers: [AppDiagnosticGateway] })
class AppDiagnosticModule {}

describe('AppModule Socket.IO gateway diagnostics', () => {
  let app: NestFastifyApplication | undefined; let client: Socket | undefined;
  afterEach(async () => { client?.disconnect(); await app?.close(); });
  it('keeps Nest Socket.IO ACK dispatch with real application configuration', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule, AppDiagnosticModule] }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureApplication(app); app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address(); if (!address || typeof address === 'string') throw new Error('Expected a TCP address.');
    client = io(`http://127.0.0.1:${address.port}/diag-app`, { forceNew: true });
    await new Promise<void>((resolve, reject) => { client?.once('connect', resolve); client?.once('connect_error', reject); });
    const ack = await new Promise<{ ok: boolean; echo: unknown }>((resolve, reject) => client?.timeout(2_000).emit('ping', { app: true }, (error: Error | null, response: { ok: boolean; echo: unknown }) => error ? reject(error) : resolve(response)));
    expect(ack).toEqual({ ok: true, echo: { app: true } });
  });
});
