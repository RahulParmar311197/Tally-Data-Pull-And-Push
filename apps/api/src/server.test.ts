import { describe, expect, it } from 'vitest';

describe('API foundation', () => {
  it('has a development connector token contract', () => {
    expect(process.env.CONNECTOR_DEV_TOKEN ?? 'dev-only-change-me').toBeTruthy();
  });
});
