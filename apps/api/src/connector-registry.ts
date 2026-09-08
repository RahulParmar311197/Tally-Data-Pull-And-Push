import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';

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
  const credential = randomBytes(32).toString('hex');
  const connector = await prisma.connector.upsert({
    where: { deviceId },
    update: { name, organizationId, credentialHash: hashCredential(credential), revokedAt: null, lastSeenAt: new Date() },
    create: { deviceId, name, organizationId, credentialHash: hashCredential(credential), lastSeenAt: new Date() },
  });
  return { connector, credential };
}

export async function authenticateConnector(deviceId: string, credential: string) {
  const connector = await prisma.connector.findUnique({ where: { deviceId } });
  if (!connector || connector.revokedAt || connector.credentialHash !== hashCredential(credential)) return null;
  return connector;
}
