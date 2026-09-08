import { createHash, timingSafeEqual } from 'node:crypto';

export function tokenMatches(candidate: string, expectedHashHex: string): boolean {
  const candidateHash = createHash('sha256').update(candidate).digest();
  let expectedHash: Buffer;
  try {
    expectedHash = Buffer.from(expectedHashHex, 'hex');
  } catch {
    return false;
  }
  return expectedHash.length === candidateHash.length && timingSafeEqual(candidateHash, expectedHash);
}
