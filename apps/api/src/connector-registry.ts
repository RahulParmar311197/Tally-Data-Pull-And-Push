import { randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';

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
    update: { name, organizationId, revokedAt: null, lastSeenAt: new Date() },
    create: { deviceId, name, organizationId, lastSeenAt: new Date() },
  });
  return { connector, credential };
}
