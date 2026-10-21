:::bug{#U1}
```cpp run=none
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
::answer
The pointer itself is atomic, but a thread on the fast path can load the new pointer without synchronizing with the constructor's writes, then read a partially constructed `Widget`: data race, UB. Use a release store and acquire loads (or just a function-local static).
:::

:::bug{#U2}
```cpp run=none
std::atomic<bool> locked{false};
void lock()   { while (locked.exchange(true, std::memory_order_relaxed)) {} }
void unlock() { locked.store(false, std::memory_order_relaxed); }
```
::answer
With relaxed ordering, writes inside the critical section aren't ordered with the lock handoff, so the next owner may not see them: data race on protected data. Use `exchange(true, acquire)` and `store(false, release)`.
:::

:::bug{#U3}
```cpp
struct Snapshot { long bid, ask; };
Snapshot snap;                  // plain struct
std::atomic<unsigned> seq{0};
// writer: seq++ (odd), write snap, seq++ (even)
// reader: s1 = seq; copy = snap; s2 = seq; retry if s1 odd or s1 != s2
```
::answer
Formally a data race: the reader copies `snap` while the writer may be writing it, even though it discards torn copies. Make the payload atomic (relaxed loads and stores of each field, or `std::atomic_ref`), with a release fence after the first `seq` increment in the writer and an acquire fence before the second `seq` read in the reader.
:::

:::bug{#U4}
```cpp
std::atomic<long> best_bid, best_ask;
// writer: best_bid.store(b); best_ask.store(a);
// reader:
long b = best_bid.load(), a = best_ask.load();
assert(b < a);
```
::answer
No UB, but the reader can see the new bid with the old ask, so the invariant can fail. Publish both together: one atomic 16-byte value, a seqlock, or a pointer to an immutable snapshot.
:::

:::bug{#U5}
```cpp run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
bool stop = false;
std::thread t([&] { while (!stop) { poll(); } });
stop = true;
t.join();
```
::answer
Data race on `stop`: UB. Nothing forces the compiler to re-read stop. With an empty loop body it's worse: GCC 14 and Clang 18 at -O2 compile while (!stop) {} to a bare return (verified), because \[intro.progress\] lets them assume a side-effect-free loop terminates. With an opaque call like poll() in the body they happen to reload the flag, but that's an accident of optimization, not a guarantee. Use `std::atomic<bool>` (or `std::jthread` with `stop_token`).
:::
