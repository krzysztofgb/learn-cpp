### Why a memory model exists

Compilers reorder, merge and eliminate memory accesses, and CPUs execute out of order and buffer stores. Both preserve single-threaded behavior ("as if"), but another thread can observe the reordering. The memory model defines which values a load may return when threads share memory, and what you must do to constrain it.

### Core definitions

- **Memory location:** a scalar object or a maximal sequence of adjacent bit-fields.
- **Conflict:** two accesses to the same location, at least one a write.
- **Data race:** two conflicting accesses in different threads, at least one non-atomic, not ordered by happens-before. **A data race is UB**, not just a wrong value.
- **Sequenced-before:** evaluation order within one thread.
- **Synchronizes-with:** a release operation on atomic `M` synchronizes with an acquire operation on `M` that reads the value written by the release (or by a later write in its release sequence).
- **Happens-before:** built from sequenced-before and synchronizes-with, transitively. If A happens-before B, B sees A's effects.
- **Modification order:** each atomic object has one total order of all writes to it that every thread agrees on (coherence). An atomic read-modify-write always reads the latest value in that order.

### Memory orders

| Order | Guarantees | Typical use |
| --- | --- | --- |
| `relaxed` | Atomicity and per-object coherence only; no ordering of other memory | Counters, statistics, sequence number generation |
| `acquire` (loads) | Later reads and writes in this thread can't move before it | Consuming published data |
| `release` (stores) | Earlier reads and writes can't move after it | Publishing data |
| `acq_rel` (RMW) | Both | Locks, refcount decrement, exchange-based handoff |
| `seq_cst` (default) | Acquire/release plus a single total order of all `seq_cst` operations that all threads agree on | Default; required for Dekker-style "store then load another variable" patterns |
| `consume` | Deprecated; compilers treat it as acquire | Avoid |

The canonical pattern, message passing:

```cpp kind=fragment run=local
int data = 0;                       // plain, non-atomic
std::atomic<bool> ready{false};
// producer
data = 42;
ready.store(true, std::memory_order_release);
// consumer
while (!ready.load(std::memory_order_acquire)) {}
assert(data == 42);                 // guaranteed, and no data race
```

The release store synchronizes with the acquire load that sees `true`, so the write to `data` happens-before the read.

### Litmus tests you must know

- **Message passing (MP):** above. With relaxed on both atomics, the consumer can see `ready == true` and still read stale data (if `data` were also an atomic read relaxed). Observable on ARM.
- **Store buffering (SB, Dekker):** T1: `x = 1; r1 = y;` T2: `y = 1; r2 = x;` Outcome `r1 == 0 && r2 == 0` is allowed with relaxed and with acquire/release, and happens on real x86 hardware because stores sit in a store buffer while later loads execute. Only `seq_cst` (or `seq_cst` fences) forbids it.
- **IRIW (independent reads of independent writes):** two writers write `x` and `y`; two readers read them in opposite orders. With acquire/release the readers may disagree on which write happened first; `seq_cst` forbids it. (ARMv8 hardware is multi-copy atomic and doesn't show this, but the C++ model allows it, and POWER hardware exhibits it.)
- **Load buffering (LB):** T1: `r1 = x; y = 1;` T2: `r2 = y; x = 1;` relaxed allows `r1 == r2 == 1` in the model, rarely seen in practice.

### Fences

`std::atomic_thread_fence(release)` before a relaxed store, paired with `atomic_thread_fence(acquire)` after a relaxed load that reads it, synchronizes like a release/acquire pair, and covers multiple atomics at once. A `seq_cst` fence prevents SB-style reordering around it. `std::atomic_signal_fence` only restrains the compiler (for signal handlers on the same thread).

### Hardware mapping

| Operation | x86-64 (TSO) | ARMv8 (AArch64) |
| --- | --- | --- |
| Load relaxed / acquire | `mov` / `mov` | `ldr` / `ldar` (or `ldapr` with RCpc) |
| Store relaxed / release | `mov` / `mov` | `str` / `stlr` |
| Load seq\_cst | `mov` | `ldar` |
| Store seq\_cst | `xchg` (or `mov` + `mfence`) | `stlr` |
| RMW (any order) | `lock`-prefixed instruction | `ldadd`/`cas`/`swp` (LSE) with acquire/release variants, or LL/SC loop |

x86's total store order already gives acquire semantics to every load and release to every store; the only reordering it allows is a later load passing an earlier store to a different address (exactly SB). That's why acquire/release code compiles to plain `mov`s on x86, and why missing orderings "work" on x86 and break on ARM. Relaxed atomics still restrain the *compiler* from tearing and eliminating accesses.

### `volatile`, lock-freedom and CAS

- `volatile` prevents the compiler from removing or merging accesses (for memory-mapped I/O). It provides no atomicity and no inter-thread ordering in C++. Using it for thread communication is a data race.
- `std::atomic<T>::is_always_lock_free` tells you whether it compiles to instructions instead of a hidden lock. Scalars and pointers are lock-free on mainstream platforms; 16-byte structs depend on the target and flags. `std::atomic_flag` is guaranteed lock-free. `std::atomic_ref` (C++20) applies atomic operations to a non-atomic object.
- `compare_exchange_weak(expected, desired)` may fail spuriously (on LL/SC architectures), so use it in a loop; `compare_exchange_strong` doesn't fail spuriously but may itself loop internally. Both write the current value into `expected` on failure. The failure memory order can be weaker than the success order.

### Practical rules

1. Default to `seq_cst` until a profile shows the cost matters.
2. Use release/acquire pairs to publish data, relaxed only for values whose ordering relative to other memory doesn't matter.
3. Write a comment justifying every non-default memory order, naming the operation it pairs with.
4. Test on ARM, run TSan, and for serious lock-free code use a model checker.
