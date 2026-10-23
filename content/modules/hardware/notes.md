### The memory hierarchy

Approximate figures for a modern desktop or server core; measure your own machine in E1.

| Level | Typical size | Latency |
| --- | --- | --- |
| Register | — | 0 cycles |
| L1 data cache | 32–48 KB (128 KB on Apple M-series performance cores) | \~4–5 cycles (\~1 ns) |
| L2 | 1–2 MB per core (Apple: large shared L2 per cluster) | \~12–16 cycles (\~3–5 ns) |
| L3 / last level | Tens of MB, shared | \~40–70 cycles (\~10–20 ns) |
| DRAM | GBs | \~80–120 ns |
| Cross-socket DRAM (NUMA) |  | +50–100 ns |

Memory moves in *cache lines*: 64 bytes on x86 and most ARM cores, 128 bytes on Apple M-series. Touching one byte loads the whole line, so use what you load (*spatial locality*) and reuse it soon (*temporal locality*). Hardware prefetchers detect sequential and constant-stride access and fetch ahead; pointer chasing defeats them because each address depends on the previous load.

Count cost in cache lines touched, not in elements processed. A loop that streams through an array much larger than the caches is limited by memory bandwidth (tens of GB/s per core), so skipping elements within a line saves almost nothing: every line still has to come from DRAM. Optimizations that reduce instructions (extra accumulators, SIMD) help only while the data fits in cache.

Out-of-order cores can keep many cache misses in flight at once (*memory-level parallelism*), but only for loads whose addresses are already known. Independent loads (`a[i]`, `a[i+1]`, …) overlap; dependent ones (`p = p->next`) serialize, paying full latency each.

Caches are set-associative: each address maps to one set with a few ways. Strides that are large powers of two (e.g. 4096 bytes) map many accesses to the same set, causing *conflict misses* even when the cache is mostly empty. Padding a row (e.g. 1024 + 16 elements) breaks the pattern.

### Data layout

- **Row-major order:** C++ arrays are laid out row by row. In `T a[R][C]` (or a flat buffer indexed `r * C + c`), consecutive `c` are adjacent and stepping `r` jumps `C * sizeof(T)` bytes. Loop with the last index innermost; a column-order walk touches a new line, and for wide rows a new page, on every access.
- **Nested vectors** (`vector<vector<T>>`) are one heap allocation per row, each reached through an extra pointer, and the rows aren't contiguous with each other. Use one `vector<T>` of size R×C with index math, or view it with `std::mdspan` (C++23).
- **Node-based containers** (`std::list`, `std::map`/`set`, and the bucket chains of `std::unordered_map`) allocate every element separately. Traversal and lookup are chains of dependent loads to scattered addresses, plus pointer overhead in every node. Contiguous alternatives: `vector`, sorted vectors and `flat_map`, open-addressing hash tables, or direct indexing (:mod[containers]).
- **AoS vs SoA:** an *array of structures* stores each object's fields together (`vector<Order>`); a *structure of arrays* stores each field in its own array (`vector<int64_t> px; vector<int32_t> qty; …`). A loop that reads one field of many objects loads whole lines either way, so with AoS most of each line is fields it doesn't need; SoA loads only the useful bytes and vectorizes easily. AoS wins when you use most fields of one object at a time. Judge a layout by *bytes loaded per useful byte*.
- **Hot/cold splitting:** move rarely used fields out of a hot struct (into a parallel array or behind an index) so more hot objects fit per line.
- **Loop order and tiling:** for algorithms that reuse data, such as matrix multiply, choose the loop order so the innermost loop walks memory sequentially (for row-major C = A·B, i-k-j streams along rows of B and C), and process the data in blocks (*tiles*) small enough to stay in L1 or L2 while they're reused.

*Further reading:* [Multidimensional C-style Arrays](https://www.learncpp.com/cpp-tutorial/multidimensional-c-style-arrays/), [Multidimensional std::array](https://www.learncpp.com/cpp-tutorial/multidimensional-stdarray/), [std::mdspan](https://en.cppreference.com/w/cpp/container/mdspan)

### Virtual memory and the TLB

Every access translates a virtual address through page tables, cached in the TLB (a few thousand entries total, L1 TLB around 64–200). With 4 KB pages, a 64-entry TLB covers only 256 KB. Large random-access working sets thrash it, and each miss triggers a page walk costing tens of cycles or more. *Huge pages* (2 MB or 1 GB on x86 Linux, "large pages" on Windows) cover far more memory per entry. macOS on Apple Silicon uses 16 KB base pages.

### The pipeline, branches and out-of-order execution

Modern cores fetch and decode several instructions per cycle and execute out of order across a window of hundreds of instructions, limited by data dependencies. Implications:

- **Branch misprediction** flushes the speculative work: around 15–20 cycles each. Predictable branches (always taken, regular patterns, or data sorted so the outcome changes once) are nearly free; data-dependent random branches are expensive. Branchless code (conditional moves `cmov` on x86 and `csel` on ARM, masks, lookup tables) trades a little extra work for no mispredictions.
- **The compiler may remove the branch for you.** For a simple body such as `if (x >= 128) sum += x;`, GCC and Clang often emit a conditional move (*if-conversion*) or vectorize the loop, so the branch in the source never reaches the CPU. Before predicting branch costs, read the assembly.
- **Dependency chains** limit speed: a floating-point sum in one accumulator runs at one add per FP-add latency (3–4 cycles), while independent accumulators run in parallel up to the core's throughput. Many cores issue two FP adds per cycle, so you need about latency × throughput accumulators (6–8) to saturate them; beyond that, more accumulators don't help. Compilers won't split an FP sum for you, because FP addition isn't associative and reordering changes the result, unless allowed (`-ffast-math`, :mod[low-latency-techniques]).
- **Indirect branches** (virtual calls, function pointers, `switch` jump tables) are predicted from history too; unpredictable targets cost the same as mispredictions. An indirect call also blocks inlining. Grouping objects by type makes targets predictable; templates or `std::variant` make them visible to the compiler (:sec[polymorphism/alternatives-to-virtual-dispatch]).
- **Store-to-load forwarding** lets a load read a just-stored value from the store buffer; mismatched sizes or misaligned overlaps can stall it.

### SIMD

One instruction processes several values: SSE (128-bit), AVX2 (256-bit) and AVX-512 (512-bit) on x86; NEON (128-bit) on ARM, plus SVE on some servers. Compilers auto-vectorize simple loops at `-O3` (GCC 12+ and Clang also at `-O2`) when they can prove it's safe. `-Rpass=loop-vectorize` and `-Rpass-missed=loop-vectorize` (Clang), `-fopt-info-vec` and `-fopt-info-vec-missed` (GCC), or `/Qvec-report:2` (MSVC) report what happened. Common blockers:

- **Possible aliasing:** if `out` might overlap `a` or `b`, writing one lane could change another lane's input. Compilers sometimes add a runtime overlap check; otherwise you can promise no overlap with `__restrict` (a GCC, Clang and MSVC extension; standard C++ has no `restrict`).
- **Loop-carried dependencies:** iteration `i` needs the result of `i - 1`.
- **FP reductions:** a vectorized sum adds in a different order, which changes an FP result, so it needs `-ffast-math` or `-fassociative-math` (integer sums vectorize freely).
- **Calls to functions that aren't inlined**, and complex control flow inside the loop.

For explicit control, use intrinsics (`<immintrin.h>` on x86, `<arm_neon.h>` on ARM) or C++26's portable `std::simd` vector types. On older Intel server CPUs, heavy AVX-512 use lowered clock frequency, so it wasn't always a win.

### Cores, coherence and NUMA

- Caches stay coherent via a protocol (MESI and variants): writing a line requires exclusive ownership, invalidating other cores' copies. That's the cost behind contended atomics and *false sharing*: two threads writing *different* variables that share a line still make the line bounce between cores. Give each thread's hot data its own line with `alignas(std::hardware_destructive_interference_size)` or padding, or keep it thread-local and combine at the end (:sec[lock-free-programming/false-sharing-and-cache-lines]).
- **SMT/hyperthreading:** two hardware threads share one core's execution units, caches and TLB; latency-critical code usually runs with its sibling idle or SMT disabled, because the sibling's work shows up as jitter.
- **NUMA:** on multi-socket servers, each socket has local memory, and each PCIe device (such as the NIC) is attached to one socket. Linux allocates on first touch, so the thread that first writes a page determines where it lives. Pin threads and their memory to the same node, ideally the NIC's (`numactl` on Linux).
- **Hybrid cores:** Apple M-series and recent Intel desktop CPUs mix performance and efficiency cores. Linux (`taskset`, `pthread_setaffinity_np`) and Windows (`SetThreadAffinityMask`) can pin a thread to a core; macOS offers no hard pinning, only QoS hints, so benchmarks there are noisier than on an isolated Linux core. Run benchmarks at high priority or QoS, and repeat them.

*Further reading:* [std::hardware_destructive_interference_size](https://en.cppreference.com/w/cpp/thread/hardware_destructive_interference_size)
