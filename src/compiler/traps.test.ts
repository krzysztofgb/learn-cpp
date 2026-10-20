import { describe, expect, it } from 'vitest';
import { UNCAUGHT_EXCEPTION } from './protocol.ts';
import { classifyTrap } from './traps.ts';

describe('classifyTrap', () => {
  it('treats a silent unreachable in debug builds as UB', () => {
    expect(classifyTrap('unreachable', '', 'debug').kind).toBe('ub');
  });

  it('recognizes std::terminate and failed assertions from what they print', () => {
    const stderr = 'libc++abi: terminating due to uncaught exception of type std::logic_error: oops\n';
    expect(classifyTrap('unreachable executed', stderr, 'debug').kind).toBe('terminate');
    expect(classifyTrap('unreachable', 'Assertion failed: x > 0', 'debug').kind).toBe('abort');
  });

  it('reports an exception that escaped main as terminate', () => {
    expect(classifyTrap(UNCAUGHT_EXCEPTION, '', 'debug')).toMatchObject({ kind: 'terminate', label: 'Uncaught exception: std::terminate' });
  });

  it('does not claim UB in release builds, which have no sanitizer', () => {
    expect(classifyTrap('unreachable', '', 'release').kind).toBe('unknown');
  });

  it.each([
    ['memory access out of bounds', 'out-of-bounds'],
    ['divide by zero', 'divide-by-zero'],
    ['Division by zero', 'divide-by-zero'],
    ['Unreachable code should not be executed', 'ub'],
    ['Maximum call stack size exceeded', 'stack-overflow'],
    ['null function or function signature mismatch', 'bad-call'],
  ])('maps %s', (message, kind) => {
    expect(classifyTrap(message, '', 'debug').kind).toBe(kind);
  });
});
