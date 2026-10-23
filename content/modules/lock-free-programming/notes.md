### Progress guarantees

| Guarantee | Meaning |
| --- | --- |
| Blocking | A thread holding a lock can stop everyone (preempted, page fault) |
| Obstruction-free | A thread running alone finishes in bounded steps |
| Lock-free | Some thread always makes progress; individual threads may starve |
| Wait-free | Every thread finishes in a bounded number of its own steps |

Lock-free is not automatically faster. Its value is predictability: no thread can stall others by being descheduled while holding a lock, and there's no priority inversion. Contended atomics still bounce cache lines, CAS loops retry (wasting the work of each failed attempt) as contention grows, and safe memory reclamation adds its own cost to every operation. A well-designed single-writer structure often beats any multi-writer one.

### CAS loops and ABA

The basic pattern: read the current value, compute a new one, `compare_exchange_weak(expected, desired)`. On success the atomic now holds `desired`; on failure the atomic is unchanged and `expected` is overwritten with its current value, so loop and recompute.

*Further reading:* [`compare_exchange` (cppreference)](https://en.cppreference.com/w/cpp/atomic/atomic/compare_exchange)

The ABA problem: a thread reads pointer `A`, gets preempted; others pop `A`, pop `B`, free them, and push a new node that reuses `A`'s address. The first thread's CAS succeeds because the pointer value matches, installing a stale `next`. Fixes:

- **Tagged pointers:** pair the pointer with a version counter that changes on every update, using a 16-byte CAS (`cmpxchg16b`, ARMv8.1 `casp`) or packing the tag into unused high pointer bits. On x86-64 and AArch64, user-space addresses usually fit in 47 or 48 bits (5-level paging on x86 and 52-bit address spaces on ARM can use more, but only when a process opts in), leaving 16 bits for a tag. Check that `std::atomic<T>::is_always_lock_free` holds for a 16-byte `T`: without `-mcx16` (x86) or LSE (ARM), the library may fall back to a lock. Careful on ARM platforms with pointer authentication (arm64e on Apple Silicon, ARMv8.3 PAC elsewhere): signed pointers carry an authentication code in their high bits, though user-space data pointers in practice have room to spare.
- **Safe memory reclamation:** never free a node while another thread might still read it, which also prevents reuse.

### Memory reclamation

The hard part of lock-free structures is knowing when a removed node can be freed.

- **Hazard pointers** (C++26 `std::hazard_pointer`): each reader publishes the pointer it's about to dereference in a per-thread slot, then re-reads the source to check the node is still reachable (otherwise it may have been retired before the slot was visible) and retries if not. A thread that unlinks a node *retires* it onto a per-thread list instead of deleting it; when the list grows past a threshold (a small multiple of the total number of hazard slots), it scans every slot and frees the retired nodes that no slot names. Bounded garbage, more expensive reads (a store and a `seq_cst` fence per protection).
- **Epoch-based reclamation:** threads announce entering and leaving critical regions with a global epoch; nodes retired in epoch e are freed once all threads have moved past it. Cheap reads, but a stalled thread blocks all reclamation.
- **RCU** (C++26 `<rcu>`): readers run almost free; writers copy, update and publish a new version, then wait for a grace period (or retire asynchronously) before freeing the old one. Ideal for read-mostly data such as instrument reference data or risk limits.
- **Reference counting:** split counts or `atomic<shared_ptr>`; simple but slow.

### SPSC ring buffer

One producer, one consumer, a power-of-two array, and two indices: `head` written only by the consumer, `tail` only by the producer. Single ownership of each index is the whole trick: because only one thread ever writes `tail_`, the producer can read it relaxed and store `t + 1` without a CAS. With a second producer, both read the same `t`, write the same slot and store the same index: a data race and lost items. "SPSC" is a contract the callers must keep, not something the queue enforces.

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

The consumer mirrors it: acquire-load `tail_`, read the slot, release-store `head_ + 1` (release so the producer doesn't overwrite a slot still being read). Key optimizations: free-running unsigned indices (full when `tail - head == N`, so all N slots are usable; unsigned subtraction stays correct when the counters wrap), cached copies of the other side's index so most operations touch no shared cache line, and `alignas` padding so `head_`, `tail_` and the buffer sit on separate cache lines. A good implementation moves an item in a few nanoseconds. Beyond that: batch (write several slots, then publish them with one release store; read every available slot after one acquire load), and pin the two threads to cores that share a cache.

The alternative to free-running indices is to keep `head` and `tail` already masked to \[0, N). Then an empty buffer and a full one both look like `head == tail`, so without a separate count the producer must treat `tail + 1 == head` (mod N) as full, and one slot always stays unused.

### False sharing and cache lines

Two threads writing different variables on the same cache line force the line to bounce between cores ("false sharing"), costing up to around 100 ns per write. Separate hot per-thread data with padding: `alignas(std::hardware_destructive_interference_size)`. Cache lines are 64 bytes on x86 and most ARM servers but 128 bytes on Apple Silicon, and adjacent-line prefetching on Intel makes 128-byte separation safer there too. To check your machine: `getconf LEVEL1_DCACHE_LINESIZE` (or `/sys/devices/system/cpu/cpu0/cache/index0/coherency_line_size`) on Linux, `sysctl hw.cachelinesize` on macOS, `GetLogicalProcessorInformation` on Windows.

`alignas(N)` on a member places it at an offset that's a multiple of N, gives the enclosing struct an alignment of at least N, and, because a struct's size is always a multiple of its alignment, pads the struct's size up to a multiple of N. Each over-aligned member therefore takes at least a full N-byte block.

To detect false sharing, `perf c2c` on Linux reports cache lines with heavy cross-core traffic and the code touching them; Intel VTune's memory access analysis does similar on Linux and Windows. Otherwise, add padding and measure: if a hot path speeds up several times, it was false sharing.

*Further reading:* [`hardware_destructive_interference_size` (cppreference)](https://en.cppreference.com/w/cpp/thread/hardware_destructive_interference_size)

### Other structures

- **Treiber stack:** a CAS on the head pointer; simple, but needs ABA protection and reclamation.
- **Michael-Scott queue:** the classic unbounded lock-free MPMC linked queue.
- **Bounded MPMC queue (Vyukov):** an array where each slot carries a sequence number; producers and consumers claim positions with a CAS on their counter and use the slot sequence to know when a slot is ready. Popular in practice. An alternative for many producers and one consumer: give each producer its own SPSC queue and have the consumer poll them all, which keeps every queue single-writer.
- **Seqlock:** a single writer increments a sequence to odd, writes the data, increments to even; readers retry if the sequence was odd or changed. Readers never block the writer, which suits top-of-book snapshots. The payload must be accessed atomically (relaxed) with fences to be free of data races, as :sec[memory-model/fences] explains, which also gives the fence placement.

### Testing

Run under TSan, stress-test on ARM with many more threads than cores, add random delays (`std::this_thread::yield`) at interesting points, and for core algorithms use a model checker such as CDSChecker, GenMC or Relacy.
