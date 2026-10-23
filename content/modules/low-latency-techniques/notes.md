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
| Copying `shared_ptr` | Atomic increment and decrement of the reference count | Pass `const T&` or `T*` when the callee doesn't take ownership |

The rows hide some common traps:

- **Exceptions** cost nothing on the non-throwing path in the usual table-based implementations, but each throw costs microseconds (:sec[error-handling/what-exceptions-cost]). Use them only for events that are truly exceptional; an outcome that happens to a few percent of messages, such as a risk rejection, is normal flow and belongs in a return value.
- **Output:** `std::endl` writes `'\n'` *and flushes the stream*, which for `cout` to a file or pipe means a `write` syscall per line. Write `'\n'` and let the buffer fill. `std::format` and `std::to_string` build a `std::string`, which may allocate.
- **A low-latency logger** keeps the hot thread to a few stores: it copies a compact binary record (timestamp, a pointer to a static format descriptor, raw argument bytes) into a preallocated SPSC ring (:sec[lock-free-programming/spsc-ring-buffer]), and a background thread formats and writes it. When the ring is full, drop the record and count the drops rather than block the hot thread.
- **Map lookups:** `map[key]` (`operator[]`) inserts a default-constructed value when the key is missing, which allocates; use `find` or `contains` to look up. A `std::string` key also costs a hash or comparisons over all its characters per lookup.
- **Small sets:** for a handful of elements (up to a few dozen), a linear scan of a contiguous array beats `std::unordered_set` or `std::set`: the data sits in one or two cache lines, the compiler can vectorize the scan, and there's no hashing or pointer chasing.
- **`shared_ptr` by value:** each copy increments the shared count with an atomic RMW and each destruction decrements it (:sec[smart-pointers/shared-ptr-internals]); pass the object by reference if the callee only uses it.

*Further reading:* [Exception dangers and downsides](https://www.learncpp.com/cpp-tutorial/exception-dangers-and-downsides/), [Introduction to iostream: cout, cin, and endl](https://www.learncpp.com/cpp-tutorial/introduction-to-iostream-cout-cin-and-endl/), [std::shared_ptr](https://www.learncpp.com/cpp-tutorial/stdshared_ptr/)

### Memory

- **Pools:** fixed-size slots with a free list; allocation and free are a few instructions.
- **Arenas / monotonic allocation:** bump a pointer, free everything at once (per message batch or per day). `std::pmr::monotonic_buffer_resource` hands out memory from a buffer you give it; when that runs out, it asks its *upstream* resource for more. With `null_memory_resource()` as upstream, which throws `std::bad_alloc` on every request, it guarantees no hidden heap use. Deallocation is a no-op: memory comes back only when the resource is destroyed or you call `release()`, so one resource can be reset and reused per batch.
- **Growth wastes arena space:** a monotonic resource never reuses freed memory, so a growing `pmr::vector` wastes every old buffer. A vector grows geometrically (libstdc++ and libc++ double the capacity starting from 1, MSVC grows by 1.5×; :sec[containers/vector]), so pushing n elements allocates every intermediate capacity and the abandoned buffers add up to about as much as the final one. `reserve` the final size up front.
- **Reserve containers that grow mid-session:** a `vector` reallocation copies or moves every element, and an `unordered_map` that exceeds its maximum load factor rehashes, allocating a new bucket array and relinking every node. Either is a latency spike at an unpredictable moment. `reserve` for the expected peak at startup, or use a preallocated fixed-capacity structure.
- **Counting allocations:** global `operator new` and `operator delete` are replaceable: defining them in your program replaces the library's versions for every `new` in the process (:sec[raw-memory/new-is-two-steps]). A replacement that bumps a `thread_local` counter turns "no allocation on the hot path" into a testable assertion. Replace all the forms you need to catch: single and array, aligned (`std::align_val_t`) and `nothrow`.
- **Indices over pointers:** 32-bit indices into an array halve memory versus 64-bit pointers and survive relocation and serialization.
- **Data layout:** choose layouts by bytes loaded per useful byte: structure of arrays for loops over one field, hot/cold splitting, flat arrays instead of node-based containers (:sec[hardware/data-layout]).
- **Prefault and lock:** touch all memory at startup (`memset`), and pin it so the first market-data burst doesn't take page faults: `mlockall` and `MAP_POPULATE` on Linux, `mlock` on macOS, `VirtualLock` on Windows (:mod[operating-system]).

*Further reading:* [std::vector resizing and capacity](https://www.learncpp.com/cpp-tutorial/stdvector-resizing-and-capacity/), [std::pmr::monotonic_buffer_resource](https://en.cppreference.com/w/cpp/memory/monotonic_buffer_resource)

### Code generation

- Optimization levels: `-O2` is the usual baseline; `-O3` adds more aggressive inlining and vectorization (measure, it's not always faster). `-march=native` enables the build machine's instruction set, so deploy only to identical CPUs or pick an explicit target. (MSVC: `/O2`, `/arch:AVX2`.)
- **LTO** (`-flto`) lets the optimizer inline and devirtualize across translation units. **PGO** (`-fprofile-generate`, then `-fprofile-use`) lays out hot code and predicts branches from real runs; typical gains are 5–15%, more for branchy code. BOLT does post-link layout optimization.
- **Inlining control:** `[[gnu::always_inline]]` for tiny hot helpers; `[[gnu::noinline]]` and `[[gnu::cold]]` for error handling, so it doesn't bloat the hot path. `[[likely]]`/`[[unlikely]]` hint layout. Inlining isn't free: every inlined copy grows the code, and hot code that no longer fits in the instruction cache (32–64 KB of L1i) or the decoded-instruction cache runs slower. It can also raise register pressure.
- **Callables:** a callable passed as a template parameter (a lambda or functor type) is known at compile time and inlines. A function pointer is an indirect call, inlined only if the compiler can see which function it holds. `std::function` adds type erasure on top: a call through its internal dispatch, which the compiler rarely sees through, and possibly a heap allocation when it stores a large callable (:sec[utilities/callables-lambdas-and-std-function]).
- **`-ffast-math`** allows reassociation and assumes no NaN or infinity. Under that assumption the compiler may fold `std::isnan(x)` to `false`, so NaN checks silently disappear. It changes results and affects every function in each translation unit compiled with it; with GCC, linking with it also adds startup code that sets flush-to-zero for the whole process. Prefer targeted flags (`-fno-math-errno`) or manual multiple accumulators.
- **Division:** division by a compile-time constant becomes multiply-and-shift (a few cycles); division by a runtime value uses the divide instruction, costing 20–40+ cycles. Precompute reciprocals or use powers of two where possible.

*Further reading:* [Inline functions and variables](https://www.learncpp.com/cpp-tutorial/inline-functions-and-variables/), [Function Pointers](https://www.learncpp.com/cpp-tutorial/function-pointers/), [The as-if rule and compile-time optimization](https://www.learncpp.com/cpp-tutorial/the-as-if-rule-and-compile-time-optimization/)

### Branchless code

A branch the predictor can't learn costs a pipeline flush (:mod[hardware]); branchless code computes both outcomes and selects one with arithmetic. The building block is a mask that is all ones or all zeros:

```cpp
#include <cstdint>
#include <cstdio>

// -1 (all ones) when cond is true, 0 when it's false
std::int32_t select(bool cond, std::int32_t a, std::int32_t b) {
    std::int32_t mask = -static_cast<std::int32_t>(cond);
    return (a & mask) | (b & ~mask);
}

std::int32_t branchless_min(std::int32_t a, std::int32_t b) { return select(a < b, a, b); }

int main() {
    std::printf("%d %d\n", select(true, 1, 2), branchless_min(7, 3));
}
```

- Since C++20, `>>` on a negative signed value is an arithmetic shift [expr.shift], so `x >> 31` is a mask of the sign bit, and `(x ^ m) - m` is `abs` (still overflow for `INT32_MIN`, as with `std::abs`).
- Multiplying by a `bool` (`sum += (x >= 128) * x`) and indexing a two-entry table are other branch-free forms.
- Compilers often produce conditional moves on their own from `std::min`, `std::max`, `?:` or a simple `if`, and may turn a branchless version back into a branch. Check the assembly, and benchmark on both predictable and random inputs: when the branch is predictable, the branchy version can win.

*Further reading:* [Bit manipulation with bitwise operators and bit masks](https://www.learncpp.com/cpp-tutorial/bit-manipulation-with-bitwise-operators-and-bit-masks/)

### Compile-time configuration

Runtime flags checked per message (`if (config.use_x)`) cost branches and block optimization. Turn configuration into template parameters or `if constexpr`, instantiate the combinations you need, and choose once at startup. The hot loop then contains only the code that runs.

*Further reading:* [Constexpr if statements](https://www.learncpp.com/cpp-tutorial/constexpr-if-statements/), [Non-type template parameters](https://www.learncpp.com/cpp-tutorial/non-type-template-parameters/)

### The machine

- Pin critical threads to dedicated cores (`pthread_setaffinity_np` or `taskset` on Linux, `SetThreadAffinityMask` on Windows; macOS has no hard pinning), isolate those cores from the scheduler (`isolcpus`, `nohz_full`, `rcu_nocbs`), and steer interrupts elsewhere (IRQ affinity). Production trading hosts are almost always Linux, so these knobs are Linux's.
- Busy-poll instead of blocking: a sleeping thread takes microseconds to wake, while a spinning one reacts in nanoseconds but burns its whole core.
- Disable deep C-states and frequency scaling (performance governor), or the first message after idle is slow.
- **Warm-up:** caches, TLBs, branch predictors, page tables and lazily resolved symbols all start cold. Prefault memory, resolve dynamic symbols at load time (link with `-Wl,-z,now` or set `LD_BIND_NOW`), and run synthetic messages through the real code path before trading. Some firms keep sending synthetic orders through the full path (stopping before the exchange) to keep it warm.
- Huge pages, `mlock`, SMT and kernel bypass are covered in Modules :mod[hardware]{bare}, :mod[operating-system]{bare} and :mod[networking]{bare}.

### Order book implementation sketch

Orders live in a preallocated pool indexed by a compact integer; an open-addressing map translates exchange order IDs to pool indices; each price level holds an intrusive doubly linked list of orders (for O(1) cancel) plus aggregate quantity; levels are stored in an array indexed by price offset (or a sorted vector) so best bid and ask are found quickly. No allocation after startup, every operation touches a handful of cache lines.
