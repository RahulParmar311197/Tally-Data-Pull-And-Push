import type { FastifyRequest } from 'fastify';

export type DevIdentity = { userId: string; organizationId: string };

export function getDevIdentity(request: FastifyRequest): DevIdentity | null {
  if (process.env.NODE_ENV === 'production') return null;
  const userId = String(request.headers['x-dev-user'] ?? 'dev-user');
  const organizationId = String(request.headers['x-dev-organization'] ?? 'dev-organization');
  if (!/^[a-zA-Z0-9_-]{3,100}$/.test(userId) || !/^[a-zA-Z0-9_-]{3,100}$/.test(organizationId)) return null;
  return { userId, organizationId };
}
