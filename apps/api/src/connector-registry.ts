import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';
import { tokenMatches } from './auth.js';

const hashCredential = (credential: string) => createHash('sha256').update(credential).digest('hex');

export async function ensureDevOrganization(userId: string, organizationId: string) {
  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: `${userId}@local.invalid`, displayName: userId },
  });
  const organization = await prisma.organization.upsert({
    where: { id: organizationId },
    update: {},
    create: { id: organizationId, name: organizationId },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    update: {},
    create: { organizationId, userId, role: 'owner' },
  });
  return { user, organization };
}

export async function registerConnector(organizationId: string, deviceId: string, name: string) {
  const existing = await prisma.connector.findUnique({ where: { deviceId } });
  if (existing && existing.organizationId !== organizationId) {
    throw new Error('CONNECTOR_OWNERSHIP_CONFLICT');
  }

  const credential = randomBytes(32).toString('hex');
  const connector = existing
    ? await prisma.connector.update({
        where: { id: existing.id },
        data: { name, credentialHash: hashCredential(credential), revokedAt: null, lastSeenAt: new Date() },
      })
    : await prisma.connector.create({
        data: { deviceId, name, organizationId, credentialHash: hashCredential(credential), lastSeenAt: new Date() },
      });
  return { connector, credential };
}

export async function authenticateConnector(deviceId: string, credential: string) {
  const connector = await prisma.connector.findUnique({ where: { deviceId } });
  if (!connector || connector.revokedAt || !tokenMatches(credential, connector.credentialHash)) return null;
  return connector;
}
