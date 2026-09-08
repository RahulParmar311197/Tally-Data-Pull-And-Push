import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { z } from 'zod';

const app = Fastify({ logger: true, genReqId: () => randomUUID() });
await app.register(cors, { origin: process.env.WEB_ORIGIN ?? true });
await app.register(websocket);

const ConnectorAuth = z.object({ type: z.literal('AUTH'), deviceId: z.string().min(8), deviceName: z.string().min(1).max(120), token: z.string().min(1) });
const Heartbeat = z.object({ type: z.literal('HEARTBEAT') });
const Company = z.object({ type: z.literal('TALLY_COMPANY'), company: z.string().nullable() });
type ConnectorState = { deviceId: string; name: string; connectedAt: number; lastSeen: number; company: string | null; socket: any };
const connectors = new Map<string, ConnectorState>();
const devToken = process.env.CONNECTOR_DEV_TOKEN ?? 'dev-only-change-me';

app.get('/health', async () => ({ ok: true, service: 'tally-api', time: new Date().toISOString() }));
app.get('/api/connectors', async () => Array.from(connectors.values()).map(({ socket: _socket, ...c }) => ({ ...c, status: Date.now() - c.lastSeen < 30_000 ? 'online' : 'offline' })));

app.register(async instance => {
  instance.get('/ws/connector', { websocket: true }, (socket, request) => {
    let deviceId: string | undefined;
    const requestId = request.id;
    socket.on('message', raw => {
      try {
        const input = JSON.parse(raw.toString());
        if (!deviceId) {
          const auth = ConnectorAuth.safeParse(input);
          if (!auth.success || auth.data.token !== devToken) {
            socket.send(JSON.stringify({ type: 'ERROR', code: 'UNAUTHORIZED', requestId }));
            socket.close();
            return;
          }
          deviceId = auth.data.deviceId;
          connectors.set(deviceId, { deviceId, name: auth.data.deviceName, connectedAt: Date.now(), lastSeen: Date.now(), company: null, socket });
          socket.send(JSON.stringify({ type: 'AUTH_OK', deviceId, requestId }));
          return;
        }
        const heartbeat = Heartbeat.safeParse(input);
        if (heartbeat.success) {
          const current = connectors.get(deviceId);
          if (current) current.lastSeen = Date.now();
          socket.send(JSON.stringify({ type: 'HEARTBEAT_ACK', ts: Date.now() }));
          return;
        }
        const company = Company.safeParse(input);
        if (company.success) {
          const current = connectors.get(deviceId);
          if (current) { current.company = company.data.company; current.lastSeen = Date.now(); }
          return;
        }
        socket.send(JSON.stringify({ type: 'ERROR', code: 'INVALID_MESSAGE', requestId }));
      } catch {
        socket.send(JSON.stringify({ type: 'ERROR', code: 'INVALID_JSON', requestId }));
      }
    });
    socket.on('close', () => { if (deviceId) connectors.delete(deviceId); });
  });
});

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: process.env.HOST ?? '127.0.0.1' });
