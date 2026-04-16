import { describe, it, expect } from 'vitest';

describe('Frontend test infrastructure', () => {
  it('vitest runs correctly', () => {
    expect(1 + 1).toBe(2);
  });

  it('jsdom environment is available', () => {
    expect(typeof document).toBe('object');
  });
});
