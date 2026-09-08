import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { getDevIdentity } from './request-auth.js';
import { authenticateConnector, ensureDevOrganization, registerConnector } from './connector-registry.js';

const app = Fastify({ logger: true, genReqId: () => randomUUID() });
await app.register(cors, { origin: process.env.WEB_ORIGIN ?? true });
await app.register(websocket);

const ConnectorAuth = z.object({ type: z.literal('AUTH'), deviceId: z.string().min(8).max(100), deviceName: z.string().min(1).max(120), token: z.string().min(32).max(128) });
const Register = z.object({ deviceId: z.string().min(8).max(100), name: z.string().min(1).max(120) });
const Read = z.object({ operation: z.enum(['current_company', 'trial_balance']) });
const Heartbeat = z.object({ type: z.literal('HEARTBEAT') });
const Company = z.object({ type: z.literal('TALLY_COMPANY'), company: z.string().nullable() });
const ReadResult = z.object({ type: z.literal('TALLY_READ_RESULT'), requestId: z.string(), operation: z.enum(['current_company', 'trial_balance']), ok: z.boolean(), data: z.unknown().optional(), error: z.string().optional() });
type ConnectorState = { deviceId: string; connectedAt: number; lastSeen: number; socket: any; pending: Map<string, (value: unknown) => void> };
type ConnectorRow = { deviceId: string; name: string; revokedAt: Date | null; lastSeenAt: Date | null };
const connectors = new Map<string, ConnectorState>();

app.get('/health', async () => ({ ok: true, service: 'tally-api', time: new Date().toISOString() }));

app.post('/api/connectors/register', async (request, reply) => {
  const identity = getDevIdentity(request);
  if (!identity) return reply.code(401).send({ error: 'UNAUTHORIZED' });
  const input = Register.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: 'INVALID_REQUEST', details: input.error.flatten() });
  await ensureDevOrganization(identity.userId, identity.organizationId);
  const result = await registerConnector(identity.organizationId, input.data.deviceId, input.data.name);
  await prisma.auditLog.create({ data: { organizationId: identity.organizationId, actorUserId: identity.userId, action: 'CONNECTOR_REGISTERED', resourceType: 'Connector', resourceId: result.connector.id, requestId: request.id, metadataJson: { deviceId: input.data.deviceId } } });
  return { deviceId: result.connector.deviceId, name: result.connector.name, credential: result.credential };
});

app.get('/api/connectors', async (request, reply) => {
  const identity = getDevIdentity(request);
  if (!identity) return reply.code(401).send({ error: 'UNAUTHORIZED' });
  const rows: ConnectorRow[] = await prisma.connector.findMany({ where: { organizationId: identity.organizationId }, orderBy: { createdAt: 'asc' } });
  return rows.map((c: ConnectorRow) => ({ deviceId: c.deviceId, name: c.name, revoked: Boolean(c.revokedAt), connected: connectors.has(c.deviceId), lastSeenAt: c.lastSeenAt }));
});

app.post('/api/connectors/:deviceId/revoke', async (request, reply) => {
  const identity = getDevIdentity(request);
  if (!identity) return reply.code(401).send({ error: 'UNAUTHORIZED' });
  const deviceId = String((request.params as { deviceId?: string }).deviceId ?? '');
  const connector = await prisma.connector.findFirst({ where: { deviceId, organizationId: identity.organizationId } });
  if (!connector) return reply.code(404).send({ error: 'NOT_FOUND' });
  await prisma.connector.update({ where: { id: connector.id }, data: { revokedAt: new Date() } });
  connectors.get(deviceId)?.socket.close();
  await prisma.auditLog.create({ data: { organizationId: identity.organizationId, actorUserId: identity.userId, action: 'CONNECTOR_REVOKED', resourceType: 'Connector', resourceId: connector.id, requestId: request.id } });
  return { ok: true };
});

app.post('/api/connectors/:deviceId/read', async (request, reply) => {
  const identity = getDevIdentity(request);
  if (!identity) return reply.code(401).send({ error: 'UNAUTHORIZED' });
  const input = Read.safeParse(request.body);
  if (!input.success) return reply.code(400).send({ error: 'INVALID_REQUEST', details: input.error.flatten() });
  const deviceId = String((request.params as { deviceId?: string }).deviceId ?? '');
  const connector = await prisma.connector.findFirst({ where: { deviceId, organizationId: identity.organizationId, revokedAt: null } });
  const state = connector ? connectors.get(deviceId) : undefined;
  if (!connector || !state) return reply.code(409).send({ error: 'CONNECTOR_OFFLINE' });
  const requestId = request.id;
  const result = await new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => { state.pending.delete(requestId); reject(new Error('CONNECTOR_TIMEOUT')); }, 15000);
    state.pending.set(requestId, value => { clearTimeout(timer); resolve(value); });
    state.socket.send(JSON.stringify({ type: 'TALLY_READ', requestId, operation: input.data.operation }));
  }).catch(error => ({ error: error instanceof Error ? error.message : 'CONNECTOR_ERROR' }));
  if ((result as { error?: string }).error) return reply.code(504).send(result);
  return result;
});

app.register(async instance => {
  instance.get('/ws/connector', { websocket: true }, (socket, request) => {
    let deviceId: string | undefined;
    const requestId = request.id;
    socket.on('message', async (raw: Buffer) => {
      try {
        const input = JSON.parse(raw.toString());
        if (!deviceId) {
          const auth = ConnectorAuth.safeParse(input);
          if (!auth.success) { socket.send(JSON.stringify({ type: 'ERROR', code: 'UNAUTHORIZED', requestId })); socket.close(); return; }
          const connector = await authenticateConnector(auth.data.deviceId, auth.data.token);
          if (!connector || connector.name !== auth.data.deviceName) { socket.send(JSON.stringify({ type: 'ERROR', code: 'UNAUTHORIZED', requestId })); socket.close(); return; }
          deviceId = connector.deviceId;
          connectors.get(deviceId)?.socket.close();
          connectors.set(deviceId, { deviceId, connectedAt: Date.now(), lastSeen: Date.now(), socket, pending: new Map() });
          await prisma.connector.update({ where: { id: connector.id }, data: { lastSeenAt: new Date() } });
          socket.send(JSON.stringify({ type: 'AUTH_OK', deviceId, requestId }));
          return;
        }
        const current = connectors.get(deviceId);
        const readResult = ReadResult.safeParse(input);
        if (readResult.success) { current?.pending.get(readResult.data.requestId)?.(readResult.data); current?.pending.delete(readResult.data.requestId); return; }
        const heartbeat = Heartbeat.safeParse(input);
        if (heartbeat.success) {
          if (current) current.lastSeen = Date.now();
          await prisma.connector.updateMany({ where: { deviceId, revokedAt: null }, data: { lastSeenAt: new Date() } });
          socket.send(JSON.stringify({ type: 'HEARTBEAT_ACK', ts: Date.now() }));
          return;
        }
        const company = Company.safeParse(input);
        if (company.success) {
          const connector = await prisma.connector.findUnique({ where: { deviceId } });
          if (!connector || connector.revokedAt) { socket.close(); return; }
          if (company.data.company) await prisma.tallyCompany.upsert({ where: { connectorId_name: { connectorId: connector.id, name: company.data.company } }, update: { lastSeenAt: new Date() }, create: { name: company.data.company, organizationId: connector.organizationId, connectorId: connector.id, lastSeenAt: new Date() } });
          await prisma.connector.update({ where: { id: connector.id }, data: { lastSeenAt: new Date() } });
          return;
        }
        socket.send(JSON.stringify({ type: 'ERROR', code: 'INVALID_MESSAGE', requestId }));
      } catch { socket.send(JSON.stringify({ type: 'ERROR', code: 'INVALID_MESSAGE', requestId })); }
    });
    socket.on('close', () => { if (deviceId && connectors.get(deviceId)?.socket === socket) connectors.delete(deviceId); });
  });
});

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: process.env.HOST ?? '127.0.0.1' });
