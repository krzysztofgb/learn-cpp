### Why a memory model exists

Compilers reorder, merge and eliminate memory accesses, and CPUs execute out of order and buffer stores. Both preserve single-threaded behavior ("as if"), but another thread can observe the reordering. The memory model defines which values a load may return when threads share memory, and what you must do to constrain it.

Because a data race is UB, the compiler may assume that no other thread changes a non-atomic variable between two of this thread's accesses unless a synchronization operation (an atomic access, a lock, a fence) separates them. So `while (!stop) {}` on a plain `bool` may load `stop` once and spin forever, or worse. The forward-progress rules (\[intro.progress\]) add that the implementation may assume every thread eventually terminates or does one of: call a library I/O function, access a `volatile` object, or perform an atomic or synchronization operation. A loop that does none of those may be assumed to terminate, so the compiler can delete it. A call to a function the compiler can't see into happens to force a reload, but only because the compiler must assume that function might synchronize; that's not a guarantee you can rely on.

*Further reading:* [Memory model (cppreference)](https://en.cppreference.com/w/cpp/language/memory_model)

### Core definitions

- **Memory location:** a scalar object or a maximal sequence of adjacent bit-fields.
- **Conflict:** two accesses to the same location, at least one a write.
- **Data race:** two conflicting accesses in different threads, at least one non-atomic, not ordered by happens-before. **A data race is UB**, not just a wrong value. The point is optimization: if every plain access had to behave sensibly under concurrent modification, compilers couldn't keep values in registers, merge or reorder loads and stores, or tear wide writes. Atomics are the opt-out, so only code that asks for it pays.
- **Sequenced-before:** evaluation order within one thread.
- **Synchronizes-with:** a release operation on atomic `M` synchronizes with an acquire operation on `M` that reads the value written by the release (or by a later write in its release sequence).
- **Happens-before:** built from sequenced-before and synchronizes-with, transitively. If A happens-before B, B sees A's effects.
- **Modification order:** each atomic object has one total order of all writes to it that every thread agrees on (coherence). An atomic read-modify-write always reads the latest value in that order, so concurrent RMWs never lose updates, whatever memory order they use.
- **Atomic RMW vs load-then-store:** on a `std::atomic`, `++a`, `a++`, `a += n` and `fetch_add` are each one indivisible read-modify-write (with `seq_cst` ordering when you don't name one). `a = a + 1` is two operations: an atomic load, then an atomic store of a value computed from it. Another thread's update between them is overwritten, so increments can be lost, but nothing races, so it isn't UB.
- **Atomicity is per object:** two separately atomic variables don't change together. A reader that loads both can see a new value of one and an old value of the other, whatever memory orders you use. Data that must be read consistently has to be published as one unit: a single atomic value, a seqlock (below), or a pointer to an immutable snapshot.

### Memory orders

| Order | Guarantees | Typical use |
| --- | --- | --- |
| `relaxed` | Atomicity and per-object coherence only; no ordering of other memory | Counters, statistics, sequence number generation |
| `acquire` (loads) | Later reads and writes in this thread can't move before it | Consuming published data |
| `release` (stores) | Earlier reads and writes can't move after it | Publishing data |
| `acq_rel` (RMW) | Both | Locks, refcount decrement, exchange-based handoff |
| `seq_cst` (default) | Acquire/release plus a single total order of all `seq_cst` operations that all threads agree on | Default; required for Dekker-style "store then load another variable" patterns |
| `consume` | Deprecated; compilers treat it as acquire | Avoid |

Release and acquire constrain only the thread that issues them: they say nothing about the order in which other threads see unrelated relaxed operations. Without a release/acquire pair (or `seq_cst`) linking two threads, a relaxed store sequence `a = 1; b = 1;` can be observed in either order.

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

*Further reading:* [`std::memory_order` (cppreference)](https://en.cppreference.com/w/cpp/atomic/memory_order)

### Litmus tests you must know

- **Message passing (MP):** above. With relaxed on both atomics, the consumer can see `ready == true` and still read stale data (if `data` were also an atomic read relaxed). Observable on ARM.
- **Store buffering (SB, Dekker):** T1: `x = 1; r1 = y;` T2: `y = 1; r2 = x;` Outcome `r1 == 0 && r2 == 0` is allowed with relaxed and with acquire/release, and happens on real x86 hardware because stores sit in a store buffer while later loads execute. Only `seq_cst` (or `seq_cst` fences) forbids it.
- **IRIW (independent reads of independent writes):** two writers write `x` and `y`; two readers read them in opposite orders. With acquire/release the readers may disagree on which write happened first; `seq_cst` forbids it. (ARMv8 hardware is multi-copy atomic and doesn't show this, but the C++ model allows it, and POWER hardware exhibits it.)
- **Load buffering (LB):** T1: `r1 = x; y = 1;` T2: `r2 = y; x = 1;` relaxed allows `r1 == r2 == 1` in the model, rarely seen in practice.

### Fences

`std::atomic_thread_fence(release)` before a relaxed store, paired with `atomic_thread_fence(acquire)` after a relaxed load that reads it, synchronizes like a release/acquire pair, and covers multiple atomics at once. A `seq_cst` fence prevents SB-style reordering around it. `std::atomic_signal_fence` only restrains the compiler (for signal handlers on the same thread).

A *seqlock* is the standard place fences appear. A single writer bumps a sequence counter to odd, writes the payload, and bumps it back to even; readers read the counter, copy the payload, read the counter again, and retry if it was odd or changed. Copying a plain payload while the writer writes it is a data race, and UB even if the torn copy is thrown away, so every payload field must be accessed atomically (relaxed atomics, or `std::atomic_ref` on plain fields). Ordering then comes from fences around the relaxed payload accesses:

- Writer: relaxed store of the odd counter, then a release fence, then the relaxed payload stores, then a release store of the even counter. The fence keeps the payload stores from becoming visible before the odd counter.
- Reader: acquire load of the counter, then the relaxed payload loads, then an acquire fence, then a relaxed load of the counter. The fence keeps the payload loads from moving after the second counter read.

*Further reading:* [`std::atomic_thread_fence` (cppreference)](https://en.cppreference.com/w/cpp/atomic/atomic_thread_fence)

### Hardware mapping

| Operation | x86-64 (TSO) | ARMv8 (AArch64) |
| --- | --- | --- |
| Load relaxed / acquire | `mov` / `mov` | `ldr` / `ldar` (or `ldapr` with RCpc) |
| Store relaxed / release | `mov` / `mov` | `str` / `stlr` |
| Load seq\_cst | `mov` | `ldar` |
| Store seq\_cst | `xchg` (or `mov` + `mfence`) | `stlr` |
| RMW (any order) | `lock`-prefixed instruction | `ldadd`/`cas`/`swp` (LSE) with acquire/release variants, or LL/SC loop |

x86's total store order already gives acquire semantics to every load and release to every store; the only reordering it allows is a later load passing an earlier store to a different address (exactly SB). That's why acquire/release code compiles to plain `mov`s on x86, and why missing orderings "work" on x86 and break on ARM. ARM (and POWER) may reorder any two plain accesses to different addresses, store-store and load-load included, so relaxed message passing can fail there in hardware. Relaxed atomics still restrain the *compiler* from tearing and eliminating accesses, but the compiler may still reorder relaxed operations on different atomics, on any hardware.

### `volatile`, lock-freedom and CAS

- `volatile` prevents the compiler from removing or merging accesses, for accesses with effects the compiler can't see: memory-mapped hardware registers, a local modified between `setjmp` and `longjmp` (only a `volatile` one keeps its value), and a `volatile std::sig_atomic_t` flag set by a signal handler. It provides no atomicity and no inter-thread ordering in C++. Using it for thread communication is a data race.
- `std::atomic<T>::is_always_lock_free` tells you whether it compiles to instructions instead of a hidden lock. Scalars and pointers are lock-free on mainstream platforms; 16-byte structs depend on the target and flags. `std::atomic_flag` is guaranteed lock-free. `std::atomic_ref` (C++20) applies atomic operations to a non-atomic object.
- `compare_exchange_weak(expected, desired)` may fail spuriously (on LL/SC architectures), so use it in a loop; `compare_exchange_strong` doesn't fail spuriously but may itself loop internally. Both write the current value into `expected` on failure. The failure memory order can be weaker than the success order. Use `strong` when a spurious failure would cost more than a retry (for example, when failure sends you down a slow path); use `weak` in a loop that retries anyway.

*Further reading:* [`compare_exchange` (cppreference)](https://en.cppreference.com/w/cpp/atomic/atomic/compare_exchange), [`is_always_lock_free` (cppreference)](https://en.cppreference.com/w/cpp/atomic/atomic/is_always_lock_free), [`std::atomic_ref` (cppreference)](https://en.cppreference.com/w/cpp/atomic/atomic_ref)

### Practical rules

1. Default to `seq_cst` until a profile shows the cost matters.
2. Use release/acquire pairs to publish data, relaxed only for values whose ordering relative to other memory doesn't matter.
3. Write a comment justifying every non-default memory order, naming the operation it pairs with.
4. Test on ARM, run TSan, and for serious lock-free code use a model checker.
