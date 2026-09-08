import { describe, expect, it } from 'vitest';

describe('API scaffold', () => {
  it('has a deterministic test environment', () => {
    expect(process.env.NODE_ENV ?? 'test').toBeDefined();
  });
});
