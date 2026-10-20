# Module 18: The C++ memory model

This is the topic quant dev interviews probe hardest. Know the definitions precisely, be able to reason about litmus tests, and know how memory orders map to x86 and ARM instructions. Your M-series Mac is a gift here: ARM reorders more aggressively than x86, so ordering bugs that hide on x86 show up on your machine.

## Notes

### 18.1 Why a memory model exists

Compilers reorder, merge and eliminate memory accesses, and CPUs execute out of order and buffer stores. Both preserve single-threaded behavior ("as if"), but another thread can observe the reordering. The memory model defines which values a load may return when threads share memory, and what you must do to constrain it.

### 18.2 Core definitions

- **Memory location:** a scalar object or a maximal sequence of adjacent bit-fields.
- **Conflict:** two accesses to the same location, at least one a write.
- **Data race:** two conflicting accesses in different threads, at least one non-atomic, not ordered by happens-before. **A data race is UB**, not just a wrong value.
- **Sequenced-before:** evaluation order within one thread.
- **Synchronizes-with:** a release operation on atomic `M` synchronizes with an acquire operation on `M` that reads the value written by the release (or by a later write in its release sequence).
- **Happens-before:** built from sequenced-before and synchronizes-with, transitively. If A happens-before B, B sees A's effects.
- **Modification order:** each atomic object has one total order of all writes to it that every thread agrees on (coherence). An atomic read-modify-write always reads the latest value in that order.

### 18.3 Memory orders

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

### 18.4 Litmus tests you must know

- **Message passing (MP):** above. With relaxed on both atomics, the consumer can see `ready == true` and still read stale data (if `data` were also an atomic read relaxed). Observable on ARM.
- **Store buffering (SB, Dekker):** T1: `x = 1; r1 = y;` T2: `y = 1; r2 = x;` Outcome `r1 == 0 && r2 == 0` is allowed with relaxed and with acquire/release, and happens on real x86 hardware because stores sit in a store buffer while later loads execute. Only `seq_cst` (or `seq_cst` fences) forbids it.
- **IRIW (independent reads of independent writes):** two writers write `x` and `y`; two readers read them in opposite orders. With acquire/release the readers may disagree on which write happened first; `seq_cst` forbids it. (ARMv8 hardware is multi-copy atomic and doesn't show this, but the C++ model allows it, and POWER hardware exhibits it.)
- **Load buffering (LB):** T1: `r1 = x; y = 1;` T2: `r2 = y; x = 1;` relaxed allows `r1 == r2 == 1` in the model, rarely seen in practice.

### 18.5 Fences

`std::atomic_thread_fence(release)` before a relaxed store, paired with `atomic_thread_fence(acquire)` after a relaxed load that reads it, synchronizes like a release/acquire pair, and covers multiple atomics at once. A `seq_cst` fence prevents SB-style reordering around it. `std::atomic_signal_fence` only restrains the compiler (for signal handlers on the same thread).

### 18.6 Hardware mapping

| Operation | x86-64 (TSO) | ARMv8 (AArch64) |
| --- | --- | --- |
| Load relaxed / acquire | `mov` / `mov` | `ldr` / `ldar` (or `ldapr` with RCpc) |
| Store relaxed / release | `mov` / `mov` | `str` / `stlr` |
| Load seq\_cst | `mov` | `ldar` |
| Store seq\_cst | `xchg` (or `mov` + `mfence`) | `stlr` |
| RMW (any order) | `lock`-prefixed instruction | `ldadd`/`cas`/`swp` (LSE) with acquire/release variants, or LL/SC loop |

x86's total store order already gives acquire semantics to every load and release to every store; the only reordering it allows is a later load passing an earlier store to a different address (exactly SB). That's why acquire/release code compiles to plain `mov`s on x86, and why missing orderings "work" on x86 and break on ARM. Relaxed atomics still restrain the *compiler* from tearing and eliminating accesses.

### 18.7 `volatile`, lock-freedom and CAS

- `volatile` prevents the compiler from removing or merging accesses (for memory-mapped I/O). It provides no atomicity and no inter-thread ordering in C++. Using it for thread communication is a data race.
- `std::atomic<T>::is_always_lock_free` tells you whether it compiles to instructions instead of a hidden lock. Scalars and pointers are lock-free on mainstream platforms; 16-byte structs depend on the target and flags. `std::atomic_flag` is guaranteed lock-free. `std::atomic_ref` (C++20) applies atomic operations to a non-atomic object.
- `compare_exchange_weak(expected, desired)` may fail spuriously (on LL/SC architectures), so use it in a loop; `compare_exchange_strong` doesn't fail spuriously but may itself loop internally. Both write the current value into `expected` on failure. The failure memory order can be weaker than the success order.

### 18.8 Practical rules

1. Default to `seq_cst` until a profile shows the cost matters.
2. Use release/acquire pairs to publish data, relaxed only for values whose ordering relative to other memory doesn't matter.
3. Write a comment justifying every non-default memory order, naming the operation it pairs with.
4. Test on ARM, run TSan, and for serious lock-free code use a model checker.

## Predict the outcome

For each, list which final results are allowed by the C++ model, and which you'd actually observe on x86 and ARM. All variables start at 0.

**P1** (`d` and `f` are `std::atomic<int>`, all relaxed)

```cpp kind=fragment run=none
// T1                              // T2
d.store(42, relaxed);              r1 = f.load(relaxed);
f.store(1, relaxed);               r2 = d.load(relaxed);
```

Can `r1 == 1 && r2 == 0`?

**P2** Same as P1, but `f.store(1, release)` and `f.load(acquire)`.

**P3**

```cpp kind=fragment run=none
// T1                              // T2
x.store(1, release);               y.store(1, release);
r1 = y.load(acquire);              r2 = x.load(acquire);
```

Can `r1 == 0 && r2 == 0`? What changes with `seq_cst`?

**P4** Four threads each run `for (int i = 0; i < 1'000'000; ++i) c.fetch_add(1, std::memory_order_relaxed);`. What's the final value of `c`?

**P5** Two threads each run `for (int i = 0; i < 1000; ++i) x = x + 1;` where `x` is `std::atomic<int>`. What's the range of possible final values? Is it UB?

**P6**

```cpp kind=fragment run=local
volatile bool ready = false;
int data = 0;
// T1: data = 42; ready = true;
// T2: while (!ready) {} std::cout << data;
```

## Spot the bug or UB

**U1**

```cpp kind=fragment run=none
std::atomic<Widget*> inst{nullptr};
Widget* get() {
    Widget* p = inst.load(std::memory_order_relaxed);
    if (!p) {
        std::lock_guard lk(m);
        p = inst.load(std::memory_order_relaxed);
        if (!p) { p = new Widget; inst.store(p, std::memory_order_relaxed); }
    }
    return p;
}
```

**U2**

```cpp kind=fragment run=none
std::atomic<bool> locked{false};
void lock()   { while (locked.exchange(true, std::memory_order_relaxed)) {} }
void unlock() { locked.store(false, std::memory_order_relaxed); }
```

**U3**

```cpp kind=fragment run=local
struct Snapshot { long bid, ask; };
Snapshot snap;                  // plain struct
std::atomic<unsigned> seq{0};
// writer: seq++ (odd), write snap, seq++ (even)
// reader: s1 = seq; copy = snap; s2 = seq; retry if s1 odd or s1 != s2
```

**U4**

```cpp kind=fragment run=local
std::atomic<long> best_bid, best_ask;
// writer: best_bid.store(b); best_ask.store(a);
// reader:
long b = best_bid.load(), a = best_ask.load();
assert(b < a);
```

**U5**

```cpp kind=fragment run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
bool stop = false;
std::thread t([&] { while (!stop) { poll(); } });
stop = true;
t.join();
```

## Exercises

**E1 ★ Message passing on your Mac.** Implement P1 as a stress test: two threads, a spin barrier to start each iteration together, 10M iterations, and count `r1 == 1 && r2 == 0` outcomes. Run with relaxed, then release/acquire. Report counts on your M-series; if you can, run on an x86 machine too.

**E2 ★★ Store buffering.** Do the same for P3. Show the forbidden-by-SC outcome appears with acquire/release on both architectures and disappears with `seq_cst`.

**E3 ★★ Read the assembly.** On Compiler Explorer, compile `load`, `store`, `exchange`, `fetch_add` and `compare_exchange_strong` with each memory order for x86-64 and ARMv8 (with and without `-march=armv8.1-a` for LSE). Fill in your own version of table 18.6.

**E4 ★★ Prove it.** For the SPSC handoff of a struct (producer writes fields, then release-stores an index; consumer acquire-loads the index, then reads fields), draw the happens-before graph and identify the synchronizes-with edge that makes the field reads race-free.

**E5 ★★★ Peterson's lock.** Implement Peterson's mutual exclusion for two threads with `seq_cst` atomics and verify it with a stress test. Weaken to acquire/release and show it fails. Explain the failure as an SB pattern.

## Interview questions

1. What is a data race, precisely? Why is it UB rather than "some value"?
2. Explain acquire and release semantics with an example.
3. When is `memory_order_relaxed` correct?
4. What does `seq_cst` give you beyond acquire/release? Give the example that needs it.
5. Is x86 sequentially consistent? What reordering does it allow?
6. Why does code with wrong memory orders often work on x86 but fail on ARM?
7. What is `volatile` for, and why is it wrong for threads?
8. `compare_exchange_weak` vs `_strong`?
9. What do fences do, and when would you use one instead of ordered operations?
10. Define happens-before and synchronizes-with.
11. Is `std::atomic<T>` always lock-free?

## Answer key

### Predict the outcome

| # | Allowed by C++? | x86 | ARM |
| --- | --- | --- | --- |
| P1 | Yes | Not observed (TSO keeps store-store and load-load order), unless the compiler reorders | Observed |
| P2 | No | No | No |
| P3 | Yes; with `seq_cst`, no | Observed (store buffer) | Observed |
| P4 | Exactly 4,000,000 |  |  |
| P5 | Anywhere from 2 to 2000; not UB |  |  |
| P6 | UB | Often "works" | May loop forever or print 0 |

- **P4:** Relaxed RMWs are still atomic and always read the latest value in modification order; nothing is lost.
- **P5:** `x = x + 1` is a separate atomic load and atomic store, so updates interleave and get lost. No data race (all accesses are atomic), just a race condition. Use `fetch_add`.
- **P6:** `volatile` gives no atomicity or ordering, so this is a data race on both variables: UB. `volatile` does force `ready` to be re-read each iteration, but nothing stops the CPU (on ARM) or the compiler from making the write to `data` visible after the write to `ready`.

### Spot the bug or UB

- **U1:** The pointer itself is atomic, but a thread on the fast path can load the new pointer without synchronizing with the constructor's writes, then read a partially constructed `Widget`: data race, UB. Use a release store and acquire loads (or just a function-local static).
- **U2:** With relaxed ordering, writes inside the critical section aren't ordered with the lock handoff, so the next owner may not see them: data race on protected data. Use `exchange(true, acquire)` and `store(false, release)`.
- **U3:** Formally a data race: the reader copies `snap` while the writer may be writing it, even though it discards torn copies. Make the payload atomic (relaxed loads and stores of each field, or `std::atomic_ref`), with a release fence after the first `seq` increment in the writer and an acquire fence before the second `seq` read in the reader.
- **U4:** No UB, but the reader can see the new bid with the old ask, so the invariant can fail. Publish both together: one atomic 16-byte value, a seqlock, or a pointer to an immutable snapshot.
- **U5:** Data race on `stop`: UB. Nothing forces the compiler to re-read stop. With an empty loop body it's worse: GCC 14 and Clang 18 at -O2 compile while (!stop) {} to a bare return (verified), because \[intro.progress\] lets them assume a side-effect-free loop terminates. With an opaque call like poll() in the body they happen to reload the flag, but that's an accident of optimization, not a guarantee. Use `std::atomic<bool>` (or `std::jthread` with `stop_token`).

### Exercise hints

- **E1:** Reset variables between iterations and start both threads from a shared atomic iteration counter so they overlap; without careful alignment you'll see zero reorderings simply because the threads never race.
- **E3:** On ARMv8.0 without LSE, RMWs become `ldaxr`/`stlxr` loops; with LSE they're single instructions like `ldaddal`.
- **E5:** Each thread stores its own flag and then loads the other's flag: the SB pattern. Without a total order both can read the other's flag as false and enter the critical section.

### Interview questions

1. Two conflicting accesses from different threads, at least one non-atomic, not ordered by happens-before. It's UB so compilers can optimize single-threaded code freely (keep values in registers, reorder, merge accesses), which would be impossible if every plain access had to behave sensibly under concurrency.
2. A release store makes all prior writes in that thread visible to any thread whose acquire load reads the stored value. The message-passing example in 18.3.
3. When only the atomic variable's own value matters: counters, statistics, IDs, flags whose readers don't then read other data based on them.
4. A single total order over all `seq_cst` operations. Store buffering (Dekker, Peterson): each thread writes its flag then reads the other's; only SC forbids both seeing 0.
5. No. It's TSO: a later load can complete before an earlier store to a different address becomes visible (store buffer). Everything else is ordered.
6. x86 provides acquire/release ordering for every plain load and store, so code missing those orders still works on x86. ARM reorders independent loads and stores, exposing the bug.
7. Accesses with side effects the compiler can't see: memory-mapped hardware registers, `setjmp`, signal handlers (with `sig_atomic_t`). It provides neither atomicity nor ordering between threads.
8. Weak may fail even if the value matched (allowing a single LL/SC attempt); use it in loops. Strong only fails on real mismatch; use it when a spurious failure would require expensive extra work.
9. Fences order relaxed operations around them without attaching order to one specific atomic. Use them when one acquire or release should cover several atomics, or in seqlocks.
10. Synchronizes-with: the edge from a release operation to an acquire operation that reads its value. Happens-before: the transitive closure of sequenced-before and synchronizes-with (roughly); if A happens-before B, B observes A.
11. No. Check `is_always_lock_free`. Large or odd-sized `T` uses a lock internally; 16-byte types depend on the CPU and compiler flags.
