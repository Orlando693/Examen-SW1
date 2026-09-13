import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { io, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';

@WebSocketGateway({ namespace: '/diag' })
class MinimalGateway {
  @SubscribeMessage('ping')
  ping(@MessageBody() body: unknown) { return { ok: true, echo: body }; }
}
@Module({ providers: [MinimalGateway] })
class MinimalWsModule {}

class InspectingIoAdapter extends IoAdapter {
  bindMessageHandlersCalls = 0;
  messages: string[] = [];
  override bindMessageHandlers(...args: Parameters<IoAdapter['bindMessageHandlers']>) {
    this.bindMessageHandlersCalls += 1;
    this.messages = args[1].map((handler) => handler.message);
    return super.bindMessageHandlers(...args);
  }
}

describe('minimal Nest Fastify Socket.IO gateway', () => {
  let app: NestFastifyApplication | undefined;
  let client: Socket | undefined;
  afterEach(async () => { client?.disconnect(); await app?.close(); });
  it('binds and acknowledges a gateway event', async () => {
    const module = await Test.createTestingModule({ imports: [MinimalWsModule] }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    const adapter = new InspectingIoAdapter(app);
    app.useWebSocketAdapter(adapter);
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP address.');
    client = io(`http://127.0.0.1:${address.port}/diag`, { forceNew: true });
    await new Promise<void>((resolve, reject) => { client?.once('connect', resolve); client?.once('connect_error', reject); });
    const response = await new Promise<{ ok: boolean; echo: unknown }>((resolve, reject) => client?.timeout(2_000).emit('ping', { value: 1 }, (error: Error | null, ack: { ok: boolean; echo: unknown }) => error ? reject(error) : resolve(ack)));
    expect(response).toEqual({ ok: true, echo: { value: 1 } });
    expect(adapter.bindMessageHandlersCalls).toBe(1);
    expect(adapter.messages).toContain('ping');
  });
});
