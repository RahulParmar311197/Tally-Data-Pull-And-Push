import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { tokenMatches } from './auth.js';

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

describe('connector authentication primitives', () => {
  it('accepts the matching SHA-256 credential hash', () => {
    const token = 'connector-secret-123';
    expect(tokenMatches(token, sha256Hex(token))).toBe(true);
  });

  it('rejects a wrong credential', () => {
    expect(tokenMatches('wrong-token', sha256Hex('real-token'))).toBe(false);
  });

  it('rejects malformed stored hashes', () => {
    expect(tokenMatches('connector-secret-123', 'not-a-valid-hash')).toBe(false);
  });
});
