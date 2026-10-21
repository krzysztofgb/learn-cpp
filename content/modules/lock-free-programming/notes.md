### Progress guarantees

| Guarantee | Meaning |
| --- | --- |
| Blocking | A thread holding a lock can stop everyone (preempted, page fault) |
| Obstruction-free | A thread running alone finishes in bounded steps |
| Lock-free | Some thread always makes progress; individual threads may starve |
| Wait-free | Every thread finishes in a bounded number of its own steps |

Lock-free is not automatically faster. Its value is predictability: no thread can stall others by being descheduled while holding a lock, and there's no priority inversion. Contended atomics still bounce cache lines, and a well-designed single-writer structure often beats any multi-writer one.

### CAS loops and ABA

The basic pattern: read the current value, compute a new one, `compare_exchange_weak(expected, desired)`; on failure `expected` is refreshed, so loop.

The ABA problem: a thread reads pointer `A`, gets preempted; others pop `A`, pop `B`, free them, and push a new node that reuses `A`'s address. The first thread's CAS succeeds because the pointer value matches, installing a stale `next`. Fixes:

- **Tagged pointers:** pair the pointer with a version counter that changes on every update, using a 16-byte CAS (`cmpxchg16b`, ARMv8.1 `casp`) or packing the tag into unused high pointer bits. Careful on Apple Silicon: arm64e pointer authentication uses high bits, though user-space data pointers in practice have room to spare.
- **Safe memory reclamation:** never free a node while another thread might still read it, which also prevents reuse.

### Memory reclamation

The hard part of lock-free structures is knowing when a removed node can be freed.

- **Hazard pointers** (C++26 `std::hazard_pointer`): each reader publishes the pointer it's about to dereference in a per-thread slot; reclaimers scan all slots and free only unprotected nodes. Bounded garbage, more expensive reads (a store and a fence per protection).
- **Epoch-based reclamation:** threads announce entering and leaving critical regions with a global epoch; nodes retired in epoch e are freed once all threads have moved past it. Cheap reads, but a stalled thread blocks all reclamation.
- **RCU** (C++26 `<rcu>`): readers run almost free; writers copy, update and publish a new version, then wait for a grace period (or retire asynchronously) before freeing the old one. Ideal for read-mostly data such as instrument reference data or risk limits.
- **Reference counting:** split counts or `atomic<shared_ptr>`; simple but slow.

### SPSC ring buffer

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

### False sharing and cache lines

Two threads writing different variables on the same cache line force the line to bounce between cores ("false sharing"), costing up to around 100 ns per write. Separate hot per-thread data with padding: `alignas(std::hardware_destructive_interference_size)`. Cache lines are 64 bytes on x86 but 128 bytes on Apple M-series (check `sysctl hw.cachelinesize`), and adjacent-line prefetching on Intel makes 128-byte separation safer there too.

### Other structures

- **Treiber stack:** a CAS on the head pointer; simple, but needs ABA protection and reclamation.
- **Michael-Scott queue:** the classic unbounded lock-free MPMC linked queue.
- **Bounded MPMC queue (Vyukov):** an array where each slot carries a sequence number; producers and consumers claim positions with a CAS on their counter and use the slot sequence to know when a slot is ready. Popular in practice.
- **Seqlock:** a single writer increments a sequence to odd, writes the data, increments to even; readers retry if the sequence was odd or changed. Readers never block the writer, which suits top-of-book snapshots. The payload must be accessed atomically (relaxed) with fences to be free of data races, as :mod[memory-model] U3 explained.

### Testing

Run under TSan, stress-test on ARM with many more threads than cores, add random delays (`std::this_thread::yield`) at interesting points, and for core algorithms use a model checker such as CDSChecker, GenMC or Relacy.
