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

Memory moves in *cache lines*: 64 bytes on x86, 128 bytes on Apple M-series. Touching one byte loads the whole line, so use what you load (*spatial locality*) and reuse it soon (*temporal locality*). Hardware prefetchers detect sequential and constant-stride access and fetch ahead; pointer chasing defeats them because each address depends on the previous load.

Caches are set-associative: each address maps to one set with a few ways. Strides that are large powers of two (e.g. 4096 bytes) map many accesses to the same set, causing *conflict misses* even when the cache is mostly empty.

### Virtual memory and the TLB

Every access translates a virtual address through page tables, cached in the TLB (a few thousand entries total, L1 TLB around 64–200). With 4 KB pages, a 64-entry TLB covers only 256 KB. Large random-access working sets thrash it, and each miss triggers a page walk costing tens of cycles or more. *Huge pages* (2 MB or 1 GB on x86 Linux) cover far more memory per entry. macOS on Apple Silicon uses 16 KB base pages.

### The pipeline, branches and out-of-order execution

Modern cores fetch and decode several instructions per cycle and execute out of order across a window of hundreds of instructions, limited by data dependencies. Implications:

- **Branch misprediction** flushes the speculative work: around 15–20 cycles each. Predictable branches (always taken, regular patterns) are nearly free; data-dependent random branches are expensive. Branchless code (conditional moves `cmov`/`csel`, masks, lookup tables) trades a little extra work for no mispredictions.
- **Dependency chains** limit speed: a floating-point sum in one accumulator runs at one add per FP-add latency (3–4 cycles), while 4 independent accumulators can run at the core's throughput. Compilers won't reorder FP math for you unless allowed (`-ffast-math`, :mod[low-latency-techniques]).
- **Indirect branches** (virtual calls, function pointers, `switch` jump tables) are predicted from history too; unpredictable targets cost the same as mispredictions.
- **Store-to-load forwarding** lets a load read a just-stored value from the store buffer; mismatched sizes or misaligned overlaps can stall it.

### SIMD

One instruction processes several values: SSE (128-bit), AVX2 (256-bit) and AVX-512 (512-bit) on x86; NEON (128-bit) on ARM, plus SVE on some servers. Compilers auto-vectorize simple loops at `-O2`/`-O3` when they can prove no aliasing and no loop-carried dependencies; `-Rpass=loop-vectorize` (Clang) and `-fopt-info-vec` (GCC) report what happened. C++26's `std::simd` provides portable explicit vector types. On older Intel server CPUs, heavy AVX-512 use lowered clock frequency, so it wasn't always a win.

### Cores, coherence and NUMA

- Caches stay coherent via a protocol (MESI and variants): writing a line requires exclusive ownership, invalidating other cores' copies. That's the cost behind false sharing and contended atomics.
- **SMT/hyperthreading:** two hardware threads share one core's resources; latency-critical code usually runs with its sibling idle or SMT disabled.
- **NUMA:** on multi-socket servers, each socket has local memory. Linux allocates on first touch, so the thread that first writes a page determines where it lives. Pin threads and their memory to the same node (`numactl`).
- **Apple M-series** mixes performance and efficiency cores and offers no hard thread pinning (only QoS hints), so benchmarks on a Mac are noisier than on an isolated Linux core. Run benchmarks with high QoS and repeat them.
