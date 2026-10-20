import { describe, expect, it } from 'vitest';
import { decodePack, encodePack } from './pack.ts';

describe('pack', () => {
  it('round-trips nested paths and binary data', () => {
    const files = [
      ['sysroot/include/a.h', new Uint8Array([1, 2, 3])],
      ['sysroot/lib/b.a', new Uint8Array([])],
      ['prelude.pch', new Uint8Array([255, 0, 7])],
    ] as const;
    const packed = encodePack(files);
    const tree = decodePack(packed.buffer as ArrayBuffer);
    expect(tree).toEqual({
      sysroot: { include: { 'a.h': new Uint8Array([1, 2, 3]) }, lib: { 'b.a': new Uint8Array([]) } },
      'prelude.pch': new Uint8Array([255, 0, 7]),
    });
  });

  it('rejects a path that descends through a file', () => {
    const packed = encodePack([['a', new Uint8Array([1])], ['a/b', new Uint8Array([2])]]);
    expect(() => decodePack(packed.buffer as ArrayBuffer)).toThrow(/conflicts/);
  });
});
