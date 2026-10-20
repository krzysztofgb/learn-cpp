# Module 19: Lock-free programming

"Implement an SPSC queue" is one of the most common quant dev interview questions, usually followed by "now make it faster" and "what about multiple producers?". This module builds on Module 18; reread its memory order table before starting.

## Notes

### 19.1 Progress guarantees

| Guarantee | Meaning |
| --- | --- |
| Blocking | A thread holding a lock can stop everyone (preempted, page fault) |
| Obstruction-free | A thread running alone finishes in bounded steps |
| Lock-free | Some thread always makes progress; individual threads may starve |
| Wait-free | Every thread finishes in a bounded number of its own steps |

Lock-free is not automatically faster. Its value is predictability: no thread can stall others by being descheduled while holding a lock, and there's no priority inversion. Contended atomics still bounce cache lines, and a well-designed single-writer structure often beats any multi-writer one.

### 19.2 CAS loops and ABA

The basic pattern: read the current value, compute a new one, `compare_exchange_weak(expected, desired)`; on failure `expected` is refreshed, so loop.

The ABA problem: a thread reads pointer `A`, gets preempted; others pop `A`, pop `B`, free them, and push a new node that reuses `A`'s address. The first thread's CAS succeeds because the pointer value matches, installing a stale `next`. Fixes:

- **Tagged pointers:** pair the pointer with a version counter that changes on every update, using a 16-byte CAS (`cmpxchg16b`, ARMv8.1 `casp`) or packing the tag into unused high pointer bits. Careful on Apple Silicon: arm64e pointer authentication uses high bits, though user-space data pointers in practice have room to spare.
- **Safe memory reclamation:** never free a node while another thread might still read it, which also prevents reuse.

### 19.3 Memory reclamation

The hard part of lock-free structures is knowing when a removed node can be freed.

- **Hazard pointers** (C++26 `std::hazard_pointer`): each reader publishes the pointer it's about to dereference in a per-thread slot; reclaimers scan all slots and free only unprotected nodes. Bounded garbage, more expensive reads (a store and a fence per protection).
- **Epoch-based reclamation:** threads announce entering and leaving critical regions with a global epoch; nodes retired in epoch e are freed once all threads have moved past it. Cheap reads, but a stalled thread blocks all reclamation.
- **RCU** (C++26 `<rcu>`): readers run almost free; writers copy, update and publish a new version, then wait for a grace period (or retire asynchronously) before freeing the old one. Ideal for read-mostly data such as instrument reference data or risk limits.
- **Reference counting:** split counts or `atomic<shared_ptr>`; simple but slow.

### 19.4 SPSC ring buffer

One producer, one consumer, a power-of-two array, and two indices: `head` written only by the consumer, `tail` only by the producer.

```cpp kind=fragment run=none
bool push(const T& v) {
    auto t = tail_.load(std::memory_order_relaxed);          // own index
    if (t - head_cache_ == N) {                              // looks full
        head_cache_ = head_.load(std::memory_order_acquire); // refresh
        if (t - head_cache_ == N) return false;
    }
    buf_[t & (N - 1)] = v;
    tail_.store(t + 1, std::memory_order_release);           // publish slot
    return true;
}
```

The consumer mirrors it: acquire-load `tail_`, read the slot, release-store `head_ + 1` (release so the producer doesn't overwrite a slot still being read). Key optimizations: free-running unsigned indices (full when `tail - head == N`, so all N slots are usable), cached copies of the other side's index so most operations touch no shared cache line, and `alignas` padding so `head_`, `tail_` and the buffer sit on separate cache lines. A good implementation moves an item in a few nanoseconds.

### 19.5 False sharing and cache lines

Two threads writing different variables on the same cache line force the line to bounce between cores ("false sharing"), costing up to around 100 ns per write. Separate hot per-thread data with padding: `alignas(std::hardware_destructive_interference_size)`. Cache lines are 64 bytes on x86 but 128 bytes on Apple M-series (check `sysctl hw.cachelinesize`), and adjacent-line prefetching on Intel makes 128-byte separation safer there too.

### 19.6 Other structures

- **Treiber stack:** a CAS on the head pointer; simple, but needs ABA protection and reclamation.
- **Michael-Scott queue:** the classic unbounded lock-free MPMC linked queue.
- **Bounded MPMC queue (Vyukov):** an array where each slot carries a sequence number; producers and consumers claim positions with a CAS on their counter and use the slot sequence to know when a slot is ready. Popular in practice.
- **Seqlock:** a single writer increments a sequence to odd, writes the data, increments to even; readers retry if the sequence was odd or changed. Readers never block the writer, which suits top-of-book snapshots. The payload must be accessed atomically (relaxed) with fences to be free of data races, as Module 18 U3 explained.

### 19.7 Testing

Run under TSan, stress-test on ARM with many more threads than cores, add random delays (`std::this_thread::yield`) at interesting points, and for core algorithms use a model checker such as CDSChecker, GenMC or Relacy.

## Predict the output

**P1**

```cpp kind=fragment run=local
std::atomic<int> a{5};
int expected = 3;
bool ok = a.compare_exchange_strong(expected, 10);
cout << ok << ' ' << expected << ' ' << a;
```

**P2**

```cpp kind=fragment run=local
struct Counters {
    alignas(64) std::atomic<long> a;
    alignas(64) std::atomic<long> b;
};
cout << sizeof(Counters) << ' ' << alignof(Counters);
```

**P3** A ring buffer of 8 slots uses masked indices `head` and `tail` in \[0, 7\] with `head == tail` meaning empty and no separate count. How many items can it hold? What changes with free-running 64-bit indices?

**P4** A Treiber stack holds `A → B → C`. Thread 1 starts `pop`: reads `head = A`, `next = B`, then is preempted. Thread 2 pops `A`, pops `B`, frees both, then pushes a new node allocated at `A`'s old address. Thread 1 resumes and does `CAS(head, A, B)`. What happens?

**P5** Two threads each increment their own `std::atomic<long>` 100M times with relaxed `fetch_add`. In version 1 the counters are adjacent in a struct; in version 2 they're 128 bytes apart. Roughly how do the run times compare on your Mac?

## Spot the UB

**U1**

```cpp kind=fragment run=none
Node* pop() {
    Node* old = head.load();
    while (old && !head.compare_exchange_weak(old, old->next)) {}
    if (old) delete old;   // freed immediately
    return old;
}
```

**U2**

```cpp kind=fragment run=none
bool push(const T& v) {
    auto t = tail_.load(std::memory_order_relaxed);
    if (t - head_.load(std::memory_order_acquire) == N) return false;
    buf_[t & (N - 1)] = v;
    tail_.store(t + 1, std::memory_order_relaxed);
    return true;
}
```

**U3**

```cpp kind=fragment run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
SpscQueue<Order, 1024> q;
std::jthread gw1([&] { while (true) q.push(next_order()); });
std::jthread gw2([&] { while (true) q.push(next_order()); });
```

**U4**

```cpp kind=fragment run=none
bool pop(T& out) {
    auto h = head_.load(std::memory_order_relaxed);
    if (h == tail_.load(std::memory_order_acquire)) return false;
    head_.store(h + 1, std::memory_order_release);
    out = buf_[h & (N - 1)];
    return true;
}
```

## Exercises

**E1 ★ False sharing.** Implement P5 and measure with no padding, 64-byte and 128-byte separation on your Mac. Explain why 64 isn't enough there.

**E2 ★★ SPSC queue.** Implement the queue from 19.4 with cached indices and padding. Measure throughput (items/s) and round-trip latency with two queues in a ping-pong, against a mutex-protected `std::deque`. Run under TSan.

**E3 ★★ ABA live.** Implement a Treiber stack without protection and a stress test that detects corruption (use a free list instead of `delete` so addresses get reused quickly). Then fix it with a tagged pointer.

**E4 ★★ Seqlock.** Implement a seqlock protecting `TopOfBook {bid_px, bid_qty, ask_px, ask_qty}` with one writer and four readers, with atomic relaxed payload accesses and correct fences. Verify readers never observe a torn snapshot (e.g. an invariant between fields the writer maintains).

**E5 ★★★ Vyukov MPMC queue.** Implement the bounded MPMC queue with per-slot sequence numbers. Compare throughput against your SPSC queue and a mutex queue at 1, 2 and 4 producers.

**E6 ★★★ Hazard pointers.** Implement single-slot-per-thread hazard pointers with retire lists and periodic scans, and use them to make your Treiber stack's `pop` safe to `delete`.

## Interview questions

1. Lock-free vs wait-free vs blocking?
2. Why isn't lock-free always faster?
3. Explain the ABA problem and two solutions.
4. Compare hazard pointers, epoch-based reclamation and RCU.
5. Implement an SPSC queue on the whiteboard and justify every memory order.
6. How would you make your SPSC queue faster?
7. What is false sharing, how do you detect it, and how do you fix it?
8. How does a seqlock work, and when would you use one?
9. How would you design an MPMC queue?
10. How do you test lock-free code?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `0 5 5` | The CAS fails and writes the current value into `expected`. |
| P2 | `128 64` | Each member starts on its own 64-byte boundary. |
| P3 | 7; with free-running indices, 8 | With masked indices, full and empty would both look like `head == tail`, so one slot stays empty. Free-running indices make full `tail - head == 8`. |
| P4 | Corruption | The CAS succeeds because `head` equals `A` again, installing freed `B` as the head: use-after-free and a corrupted stack. |
| P5 | Adjacent is several times slower | Every increment invalidates the other core's copy of the shared line. On Apple M-series, 128-byte separation is needed because lines are 128 bytes. |

### Spot the UB

- **U1:** Another thread may have loaded `old` and be reading `old->next` when it's deleted: use-after-free. Also the ABA problem. Use hazard pointers, epochs, or never free nodes (pool with tagged pointers).
- **U2:** The relaxed store to `tail_` doesn't publish the slot write, so the consumer can read the slot before the value lands: data race. Use `memory_order_release`.
- **U3:** Two producers write `tail_` and the same slots concurrently: data race. SPSC means exactly one producer; use an MPMC queue or one SPSC queue per producer.
- **U4:** The slot is released to the producer before it's read, so the producer can overwrite it while the consumer reads: data race. Read the slot first, then release-store `head_`.

### Exercise hints

- **E2:** Typical results: well under 10 ns per item for SPSC throughput; round-trip latency dominated by cache-line transfers between the two cores (around 50–200 ns depending on the machine).
- **E3:** Pack a 16-bit tag in the top bits of a 64-bit pointer (user addresses fit in 48 bits), or use `std::atomic` of a 16-byte struct and check it's lock-free.
- **E4:** Writer: `seq.store(s + 1, relaxed); atomic_thread_fence(release);` write fields relaxed; `seq.store(s + 2, release)`. Reader: `s1 = seq.load(acquire);` read fields relaxed; `atomic_thread_fence(acquire); s2 = seq.load(relaxed);`.

### Interview questions

1. Blocking: a stalled thread can stop others. Lock-free: the system as a whole always progresses. Wait-free: every thread progresses within a bound.
2. Contended atomic RMWs serialize on cache lines just like locks, CAS loops retry under contention, and reclamation schemes add overhead. A mutex-free design with a single writer usually wins.
3. A CAS succeeds because a value returned to its old bit pattern even though the state changed. Fix with version tags (double-width CAS) or by preventing reuse through safe reclamation.
4. Hazard pointers: per-pointer protection, bounded memory, costlier reads. Epochs: very cheap reads, unbounded garbage if a thread stalls. RCU: near-free readers, writers wait for grace periods; best for read-mostly data.
5. See 19.4: each side loads its own index relaxed, the other side's with acquire, and publishes its own with release after touching the slot.
6. Cache the other side's index, pad indices and buffer to separate cache lines, use power-of-two masking, batch pushes and pops (publish several at once), and pin threads to cores sharing a cache.
7. Unrelated variables on one cache line written by different cores, causing coherence traffic. Detect with `perf c2c` on Linux or by experiments with padding; fix by padding/aligning to the cache-line size or making data per-thread.
8. A sequence counter: odd while writing. Readers copy the data and retry if the counter was odd or changed. Use it for small, frequently read data with one writer, where readers must never block the writer: top of book, latest prices.
9. Bounded array with per-slot sequence numbers (Vyukov): CAS on enqueue/dequeue positions, slot sequence tells whether it's ready. Or shard into per-producer SPSC queues with a consumer that polls them all.
10. TSan, stress tests on ARM with oversubscription and injected yields, invariant checks, long soak runs, and model checking of the core algorithm.
