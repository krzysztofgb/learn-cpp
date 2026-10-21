### The hot-path checklist

| Avoid on the hot path | Because | Instead |
| --- | --- | --- |
| Heap allocation | Unbounded latency, locks inside malloc, page faults | Preallocated pools, arenas, `pmr`, fixed-capacity containers |
| System calls | Hundreds of ns to µs, kernel jitter | Kernel bypass, shared memory, batched work |
| Locks | Contention, sleeping, priority inversion | Single-writer design, SPSC queues |
| Throwing exceptions | Microseconds per throw | Error codes or `expected` |
| Virtual calls in tight loops | No inlining, indirect branches | Templates, CRTP, `variant`, grouping by type |
| Unpredictable branches | \~15–20 cycles each | Branchless code, sorting, splitting hot and cold paths |
| Pointer chasing | Cache misses | Contiguous arrays, indices instead of pointers |
| Logging and formatting | Formatting costs µs, I/O blocks | Binary records into an SPSC ring, formatted on another thread |
| `std::string` keys, `std::map` | Allocation, comparisons, tree walks | Interned integer IDs, flat or direct-indexed tables |

### Memory

- **Pools:** fixed-size slots with a free list; allocation and free are a few instructions.
- **Arenas / monotonic allocation:** bump a pointer, free everything at once (per message batch or per day). `std::pmr::monotonic_buffer_resource` over a stack or preallocated buffer with `null_memory_resource()` upstream guarantees no hidden heap use (it throws `bad_alloc` instead). Note that a monotonic resource never reuses freed memory, so a growing `pmr::vector` wastes every old buffer.
- **Indices over pointers:** 32-bit indices into an array halve memory versus 64-bit pointers and survive relocation and serialization.
- **Prefault and lock:** touch all memory at startup (`memset`), and on Linux use `mlockall` and `MAP_POPULATE` so the first market-data burst doesn't take page faults.

### Code generation

- Optimization levels: `-O2` is the usual baseline; `-O3` adds more aggressive inlining and vectorization (measure, it's not always faster). `-march=native` enables the build machine's instruction set, so deploy only to identical CPUs or pick an explicit target.
- **LTO** (`-flto`) lets the optimizer inline and devirtualize across translation units. **PGO** (`-fprofile-generate`, then `-fprofile-use`) lays out hot code and predicts branches from real runs; typical gains are 5–15%. BOLT does post-link layout optimization.
- **Inlining control:** `[[gnu::always_inline]]` for tiny hot helpers; `[[gnu::noinline]]` and `[[gnu::cold]]` for error handling, so it doesn't bloat the hot path. `[[likely]]`/`[[unlikely]]` hint layout.
- **`-ffast-math`** allows reassociation and assumes no NaN or infinity. It changes results, can make `std::isnan` checks always false, and affects every function compiled with it. Prefer targeted flags (`-fno-math-errno`) or manual multiple accumulators.
- **Division:** division by a compile-time constant becomes multiply-and-shift; division by a runtime value costs 20–40+ cycles. Precompute reciprocals or use powers of two where possible.

### Compile-time configuration

Runtime flags checked per message (`if (config.use_x)`) cost branches and block optimization. Turn configuration into template parameters or `if constexpr`, instantiate the combinations you need, and choose once at startup. The hot loop then contains only the code that runs.

### The machine

- Pin critical threads to dedicated cores (`pthread_setaffinity_np`, `taskset`), isolate those cores from the scheduler (`isolcpus`, `nohz_full`, `rcu_nocbs`), and steer interrupts elsewhere (IRQ affinity).
- Busy-poll instead of blocking: a sleeping thread takes microseconds to wake.
- Disable deep C-states and frequency scaling (performance governor), or the first message after idle is slow.
- **Warm-up:** caches, TLBs, branch predictors and lazily resolved symbols all start cold. Some firms send synthetic orders through the full path (stopping before the exchange) to keep it warm.

### Order book implementation sketch

Orders live in a preallocated pool indexed by a compact integer; an open-addressing map translates exchange order IDs to pool indices; each price level holds an intrusive doubly linked list of orders (for O(1) cancel) plus aggregate quantity; levels are stored in an array indexed by price offset (or a sorted vector) so best bid and ask are found quickly. No allocation after startup, every operation touches a handful of cache lines.
