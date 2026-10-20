import type { Profile } from './flags.ts';
import { UNCAUGHT_EXCEPTION } from './protocol.ts';

export type TrapKind = 'ub' | 'terminate' | 'abort' | 'out-of-bounds' | 'divide-by-zero' | 'stack-overflow' | 'bad-call' | 'unknown';

export interface Trap {
  kind: TrapKind;
  /** What the learner sees. */
  label: string;
  /** The raw WebAssembly trap message. */
  message: string;
}


/**
 * Trap-mode UBSan, abort() and __builtin_trap() all surface as the same `unreachable` trap,
 * so stderr decides: terminate and assert print a reason first, UBSan traps print nothing.
 * A silent abort() in a debug build is indistinguishable from a UBSan trap and reads as UB.
 */
export function classifyTrap(message: string, stderr: string, profile: Profile): Trap {
  const make = (kind: TrapKind, label: string): Trap => ({ kind, label, message });
  if (message === UNCAUGHT_EXCEPTION) return make('terminate', 'Uncaught exception: std::terminate');
  const text = message.toLowerCase();
  if (text.includes('unreachable')) {
    // The prelude's terminate handler prints libc++'s message before aborting.
    if (stderr.includes('libc++abi: terminating')) return make('terminate', 'std::terminate called');
    if (stderr.includes('Assertion failed')) return make('abort', 'Assertion failed');
    if (stderr.length > 0) return make('abort', 'Program aborted');
    return profile === 'debug'
      ? make('ub', 'UB detected (UBSan trap)')
      : make('unknown', 'Trapped (reached unreachable code)');
  }
  // The wasm stack grows down toward address 0, so deep recursion also ends here.
  if (text.includes('out of bounds')) return make('out-of-bounds', 'Memory access out of bounds (bad pointer or stack overflow)');
  if (text.includes('divide by zero') || text.includes('division by zero') || text.includes('integer overflow')) return make('divide-by-zero', 'Integer division trap');
  if (text.includes('call stack') || text.includes('stack overflow') || text.includes('too much recursion')) {
    return make('stack-overflow', 'Stack overflow');
  }
  if (text.includes('signature mismatch') || text.includes('null function') || text.includes('indirect call')) {
    return make('bad-call', 'Bad indirect call');
  }
  return make('unknown', 'Trapped');
}
