import { createHash, timingSafeEqual } from 'node:crypto';

export function tokenMatches(candidate: string, expectedHashHex: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHashHex)) return false;
  const candidateHash = createHash('sha256').update(candidate).digest();
  const expectedHash = Buffer.from(expectedHashHex, 'hex');
  return timingSafeEqual(candidateHash, expectedHash);
}
