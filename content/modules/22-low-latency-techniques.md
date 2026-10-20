# Module 22: Low-latency techniques

This module turns Module 21's hardware facts into coding rules. Interviewers often ask open questions like "how would you make this faster?" or "what would you avoid on the hot path?"; the answer is a checklist you should be able to recite and justify.

## Notes

### 22.1 The hot-path checklist

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

### 22.2 Memory

- **Pools:** fixed-size slots with a free list; allocation and free are a few instructions.
- **Arenas / monotonic allocation:** bump a pointer, free everything at once (per message batch or per day). `std::pmr::monotonic_buffer_resource` over a stack or preallocated buffer with `null_memory_resource()` upstream guarantees no hidden heap use (it throws `bad_alloc` instead). Note that a monotonic resource never reuses freed memory, so a growing `pmr::vector` wastes every old buffer.
- **Indices over pointers:** 32-bit indices into an array halve memory versus 64-bit pointers and survive relocation and serialization.
- **Prefault and lock:** touch all memory at startup (`memset`), and on Linux use `mlockall` and `MAP_POPULATE` so the first market-data burst doesn't take page faults.

### 22.3 Code generation

- Optimization levels: `-O2` is the usual baseline; `-O3` adds more aggressive inlining and vectorization (measure, it's not always faster). `-march=native` enables the build machine's instruction set, so deploy only to identical CPUs or pick an explicit target.
- **LTO** (`-flto`) lets the optimizer inline and devirtualize across translation units. **PGO** (`-fprofile-generate`, then `-fprofile-use`) lays out hot code and predicts branches from real runs; typical gains are 5–15%. BOLT does post-link layout optimization.
- **Inlining control:** `[[gnu::always_inline]]` for tiny hot helpers; `[[gnu::noinline]]` and `[[gnu::cold]]` for error handling, so it doesn't bloat the hot path. `[[likely]]`/`[[unlikely]]` hint layout.
- **`-ffast-math`** allows reassociation and assumes no NaN or infinity. It changes results, can make `std::isnan` checks always false, and affects every function compiled with it. Prefer targeted flags (`-fno-math-errno`) or manual multiple accumulators.
- **Division:** division by a compile-time constant becomes multiply-and-shift; division by a runtime value costs 20–40+ cycles. Precompute reciprocals or use powers of two where possible.

### 22.4 Compile-time configuration

Runtime flags checked per message (`if (config.use_x)`) cost branches and block optimization. Turn configuration into template parameters or `if constexpr`, instantiate the combinations you need, and choose once at startup. The hot loop then contains only the code that runs.

### 22.5 The machine

- Pin critical threads to dedicated cores (`pthread_setaffinity_np`, `taskset`), isolate those cores from the scheduler (`isolcpus`, `nohz_full`, `rcu_nocbs`), and steer interrupts elsewhere (IRQ affinity).
- Busy-poll instead of blocking: a sleeping thread takes microseconds to wake.
- Disable deep C-states and frequency scaling (performance governor), or the first message after idle is slow.
- **Warm-up:** caches, TLBs, branch predictors and lazily resolved symbols all start cold. Some firms send synthetic orders through the full path (stopping before the exchange) to keep it warm.

### 22.6 Order book implementation sketch

Orders live in a preallocated pool indexed by a compact integer; an open-addressing map translates exchange order IDs to pool indices; each price level holds an intrusive doubly linked list of orders (for O(1) cancel) plus aggregate quantity; levels are stored in an array indexed by price offset (or a sorted vector) so best bid and ask are found quickly. No allocation after startup, every operation touches a handful of cache lines.

## Predict

**P1** What can Clang emit for this function at `-O2 -ffast-math`?

```cpp kind=fragment run=godbolt note="This asks about generated code: read the -O2 -ffast-math assembly in Compiler Explorer."
bool bad(double x) { return std::isnan(x); }
```

**P2**

```cpp kind=fragment run=local
std::array<std::byte, 1024> buf;
std::pmr::monotonic_buffer_resource res(buf.data(), buf.size(),
                                        std::pmr::null_memory_resource());
std::pmr::vector<int> v(&res);
for (int i = 0; i < 300; ++i) v.push_back(i);
```

**P3** Which is faster for checking whether a symbol ID is one of 8 IDs: a linear scan of a `std::array<int, 8>` or `std::unordered_set<int>::contains`?

**P4** Which costs more, `x / 10` or `x / d` where `d` is a runtime variable holding 10? Why?

**P5** A hot loop calls a callback 10M times. Rank by speed: a template parameter, a function pointer, `std::function`.

## Spot the performance bug

**B1**

```cpp kind=fragment run=none
void on_fill(const Fill& f) {
    logger.info(std::format("fill {} {} @ {}", f.id, f.qty, f.px));
    update_position(f);
}
```

**B2**

```cpp kind=fragment run=none
for (const auto& q : quotes) std::cout << q.px << std::endl;
```

**B3**

```cpp kind=fragment run=none
void route(std::shared_ptr<Order> o);   // called per message
```

**B4**

```cpp kind=fragment run=none
std::unordered_map<std::string, Book> books;
books[msg.symbol].apply(msg);           // per message
```

**B5**

```cpp kind=fragment run=none
if (!risk.check(order)) throw RejectError(order.id);   // ~2% of orders
```

**B6**

```cpp kind=fragment run=none
std::unordered_map<uint64_t, Order*> live_orders;       // grows during the session
```

## Exercises

**E1 ★ Allocation tripwire.** Replace global `operator new` to count allocations per thread. Write a test asserting that processing 1M synthetic market-data messages performs zero allocations after warm-up.

**E2 ★★ Arena per batch.** Build `MarketEvent` objects for each batch in a `monotonic_buffer_resource` that's reset after the batch. Compare throughput and tail latency against default allocation.

**E3 ★★ Low-latency logger.** The hot thread writes a record (timestamp, format-string pointer, raw argument bytes) into an SPSC ring; a background thread formats and writes it. Measure the hot-path cost per log call in nanoseconds, compared with formatting inline.

**E4 ★★ Branchless toolkit.** Implement branchless `min`, `max`, `abs`, `clamp` and `select(cond, a, b)` with masks, compare their assembly with `std::` versions, and benchmark on random vs predictable inputs.

**E5 ★★ PGO and LTO.** Take one earlier benchmark (an order book or a parser), build it plain, with LTO, with PGO, and with both. Record speedups and inspect what changed (inlining decisions, block layout).

**E6 ★★★ Fast order book.** Implement the design in 22.6 supporting add, cancel, modify and execute, plus best bid/ask queries. Drive it with a synthetic stream (e.g. 60% adds, 35% cancels, 5% executes, concentrated near the top of book) and target under 100 ns median per operation on your Mac. Report p50, p99 and p99.9.

## Interview questions

1. What would you avoid on a latency-critical path, and why?
2. How do you avoid heap allocation after startup?
3. Design a logger that adds only nanoseconds to the hot path.
4. What does `-ffast-math` do, and why is it dangerous?
5. What are LTO and PGO, and what gains can you expect?
6. Why can inlining hurt performance?
7. Why warm up a trading system, and how?
8. What OS and hardware settings matter for low latency?
9. Busy-polling vs blocking: trade-offs?
10. Walk me through a fast order book design.
11. Why use indices instead of pointers?

## Answer key

### Predict

| # | Answer | Why |
| --- | --- | --- |
| P1 | `return false` | Fast-math lets the compiler assume NaN never occurs. |
| P2 | Throws `std::bad_alloc` while pushing the 129th element | Growth allocates 4, 8, ..., 512 bytes (1020 total, never reused), leaving no room for the 1024-byte buffer. |
| P3 | Linear scan | 32 bytes in one or two cache lines, branch-friendly or vectorized; hashing plus a bucket chase costs more. |
| P4 | `x / d` | Constant division becomes a multiply and shift (\~3–5 cycles); runtime division uses the slow divide instruction. |
| P5 | Template, then function pointer, then `std::function` | The template inlines; the pointer is an indirect call; `std::function` adds type erasure on top. |

### Spot the performance bug

- **B1:** `std::format` allocates and formats on the hot path, and the logger may lock or do I/O. Log binary data to a ring buffer and format elsewhere, after updating the position.
- **B2:** `std::endl` flushes on every line, a syscall each time. Use `'\n'` and keep printing off the hot path.
- **B3:** Passing `shared_ptr` by value does an atomic increment and decrement per call. Pass `const Order&` or `Order*`.
- **B4:** Hashing a string and possibly allocating (`operator[]` inserts) per message. Map symbols to integer IDs once and index an array.
- **B5:** A 2% rejection rate is normal flow, not exceptional; each throw costs microseconds. Return a result code.
- **B6:** The map rehashes when it grows, allocating and moving everything mid-session: a latency spike. `reserve` up front for the expected peak, or use a preallocated open-addressing table.

### Exercise hints

- **E1:** Use a `thread_local` counter in your `operator new`, and remember `operator new[]` and the aligned overloads too.
- **E3:** Copy arguments as raw bytes with their types encoded in the format-string descriptor (known at compile time), so the hot path is a few stores.
- **E6:** Typical bottlenecks are the ID map and cancel; an intrusive list makes cancel O(1) and the map lookup becomes the dominant cost.

### Interview questions

1. See table 22.1: allocation, syscalls, locks, exceptions, virtual calls, unpredictable branches, pointer chasing, inline logging, string keys and node-based containers.
2. Preallocate pools and arenas sized for peak load at startup, use fixed-capacity containers and `pmr` with a null upstream, `reserve` everything, and test with an allocation counter.
3. Hot thread copies a compact binary record into a preallocated SPSC ring and never formats or blocks; a background thread formats and writes. If the ring is full, drop and count rather than block.
4. Lets the compiler reorder and simplify floating-point math as if it were real arithmetic and assume no NaN/infinity. Results change, NaN checks vanish, and it applies to whole translation units.
5. LTO optimizes across translation units (inlining, devirtualization). PGO uses runtime profiles for layout, inlining and branch decisions. Gains of roughly 5–15% are common, more for branchy code.
6. It grows code size, pushing hot code out of the instruction cache, and can increase register pressure. Keep cold paths out of line.
7. Caches, TLB, branch predictors, page tables and lazy binding all start cold, so the first events are slow. Warm by prefaulting memory and running synthetic messages through the real code path.
8. Core isolation, thread pinning, IRQ affinity, huge pages, `mlock`, disabling deep C-states and frequency scaling, disabling SMT or idling siblings, and kernel bypass networking.
9. Busy-polling gives the lowest, most consistent latency but burns a whole core; blocking saves CPU but adds microseconds of wakeup latency and jitter.
10. See 22.6: pooled orders, ID map, intrusive per-level lists, levels in an array or sorted vector, aggregate quantities, no allocation.
11. Half the memory (32-bit), better cache density, stable across reallocation and process boundaries, and easier to validate.
