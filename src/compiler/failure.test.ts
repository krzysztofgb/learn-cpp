import { describe, expect, it } from 'vitest';
import { describeFailure } from './failure.ts';

describe('describeFailure', () => {
  it('turns download failures into a connection problem with a next step', () => {
    for (const raw of ['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'Failed to download sysroot.tar: HTTP 404', 'Failed to load the toolchain manifest: HTTP 500']) {
      expect(describeFailure(raw)).toMatch(/^Couldn’t download the compiler\. Check your connection/);
    }
  });

  it('tells a timeout and an unknown crash apart', () => {
    expect(describeFailure('The compiler did not respond in time.')).toMatch(/took too long/);
    expect(describeFailure('The program runner crashed.')).toMatch(/failed unexpectedly/);
  });
});
