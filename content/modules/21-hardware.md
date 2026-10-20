# Module 21: Hardware for C++ programmers

At nanosecond scale, performance is mostly about memory access patterns and branch behavior, not instruction counts. Interviewers expect latency numbers from memory and the ability to predict which of two loops is faster and why.

## Notes

### 21.1 The memory hierarchy

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

### 21.2 Virtual memory and the TLB

Every access translates a virtual address through page tables, cached in the TLB (a few thousand entries total, L1 TLB around 64–200). With 4 KB pages, a 64-entry TLB covers only 256 KB. Large random-access working sets thrash it, and each miss triggers a page walk costing tens of cycles or more. *Huge pages* (2 MB or 1 GB on x86 Linux) cover far more memory per entry. macOS on Apple Silicon uses 16 KB base pages.

### 21.3 The pipeline, branches and out-of-order execution

Modern cores fetch and decode several instructions per cycle and execute out of order across a window of hundreds of instructions, limited by data dependencies. Implications:

- **Branch misprediction** flushes the speculative work: around 15–20 cycles each. Predictable branches (always taken, regular patterns) are nearly free; data-dependent random branches are expensive. Branchless code (conditional moves `cmov`/`csel`, masks, lookup tables) trades a little extra work for no mispredictions.
- **Dependency chains** limit speed: a floating-point sum in one accumulator runs at one add per FP-add latency (3–4 cycles), while 4 independent accumulators can run at the core's throughput. Compilers won't reorder FP math for you unless allowed (`-ffast-math`, Module 22).
- **Indirect branches** (virtual calls, function pointers, `switch` jump tables) are predicted from history too; unpredictable targets cost the same as mispredictions.
- **Store-to-load forwarding** lets a load read a just-stored value from the store buffer; mismatched sizes or misaligned overlaps can stall it.

### 21.4 SIMD

One instruction processes several values: SSE (128-bit), AVX2 (256-bit) and AVX-512 (512-bit) on x86; NEON (128-bit) on ARM, plus SVE on some servers. Compilers auto-vectorize simple loops at `-O2`/`-O3` when they can prove no aliasing and no loop-carried dependencies; `-Rpass=loop-vectorize` (Clang) and `-fopt-info-vec` (GCC) report what happened. C++26's `std::simd` provides portable explicit vector types. On older Intel server CPUs, heavy AVX-512 use lowered clock frequency, so it wasn't always a win.

### 21.5 Cores, coherence and NUMA

- Caches stay coherent via a protocol (MESI and variants): writing a line requires exclusive ownership, invalidating other cores' copies. That's the cost behind false sharing and contended atomics.
- **SMT/hyperthreading:** two hardware threads share one core's resources; latency-critical code usually runs with its sibling idle or SMT disabled.
- **NUMA:** on multi-socket servers, each socket has local memory. Linux allocates on first touch, so the thread that first writes a page determines where it lives. Pin threads and their memory to the same node (`numactl`).
- **Apple M-series** mixes performance and efficiency cores and offers no hard thread pinning (only QoS hints), so benchmarks on a Mac are noisier than on an isolated Linux core. Run benchmarks with high QoS and repeat them.

## Predict: which is faster, and by roughly how much?

**P1** Summing a 4096×4096 `int` matrix stored row-major: row-by-row vs column-by-column.

**P2**

```cpp kind=fragment run=none
for (int x : data) if (x >= 128) sum += x;   // data: 32M random bytes
```

On sorted vs unsorted `data`. Does `-O3` change the answer?

**P3** Traversing 1M ints in a `std::vector` vs a `std::list`.

**P4** Over a 256 MB `int` array: loop A touches every element; loop B touches every 16th element (one per 64-byte line). How do their times compare?

**P5** Summing 10M doubles with one accumulator vs four accumulators (no `-ffast-math`).

**P6** Updating the `px` field of 1M orders stored as `struct Order { int64_t px; char other[56]; }` vs a separate `std::vector<int64_t> px`.

## Spot the performance bug

**B1**

```cpp kind=fragment run=local
std::vector<std::vector<double>> matrix(4096, std::vector<double>(4096));
```

**B2**

```cpp kind=fragment run=none
std::map<int64_t, Order> orders_by_id;   // looked up on every message
```

**B3**

```cpp kind=fragment run=local
float grid[64][1024];
for (int c = 0; c < 1024; ++c)
    for (int r = 0; r < 64; ++r) grid[r][c] *= 2;
```

**B4**

```cpp kind=fragment run=local
long msgs_per_thread[8];   // thread i increments msgs_per_thread[i]
```

**B5**

```cpp kind=fragment run=none
for (auto* h : handlers) h->on_tick(tick);   // 10 handler types, randomly ordered
```

## Exercises

**E1 ★ Map your memory hierarchy.** Write a pointer-chasing benchmark: a random cyclic permutation over buffers from 4 KB to 1 GB, measure ns per load, and plot latency vs size. Identify L1, L2, (L3) and DRAM on your Mac, and on an x86 cloud VM if you can.

**E2 ★★ Branch prediction.** Implement P2. Then write a branchless version (`sum += (x >= 128) * x;` or a mask), compare times on sorted and unsorted data, and check the assembly for `csel`/`cmov` and vector instructions at `-O2` and `-O3`.

**E3 ★★ SoA vs AoS.** Implement P6 with both layouts and also with a 16-byte `Order`. Explain results in terms of bytes loaded per useful byte.

**E4 ★★ Vectorization.** Write a dot product, confirm it vectorizes using the compiler remarks, break vectorization with possibly-aliasing pointers, fix it with `__restrict`, then write it with `std::simd` (or NEON intrinsics) and compare.

**E5 ★★★ Matrix multiply.** Implement 1024×1024 `double` multiplication in i-j-k order, i-k-j order, and with blocking (tiling) for cache. Report GFLOP/s for each and explain the differences.

**E6 ★★ Accumulators.** Implement P5 with 1, 2, 4 and 8 accumulators and find where speedup stops; relate it to the FP add latency and throughput of your core.

## Interview questions

1. Give approximate latencies for L1, L2, L3 and main memory.
2. What's a cache line, and why does it matter for data structure design?
3. What are conflict misses, and when do power-of-two sizes hurt?
4. What is the TLB, and when do huge pages help?
5. What does a branch misprediction cost, and how do you avoid them?
6. Why are linked lists slow even when operations are O(1)?
7. Explain SoA vs AoS with an example.
8. What is NUMA, and how does it affect a trading server?
9. Would you enable hyperthreading on a latency-critical box?
10. What does out-of-order execution mean for how you write loops?
11. When does SIMD help, and what prevents auto-vectorization?

## Answer key

### Predict

| # | Answer | Why |
| --- | --- | --- |
| P1 | Row-major many times faster: 14× measured (x86 VM, GCC 14 `-O2`); expect roughly 5–15× | Sequential access uses whole lines and the prefetcher; column order loads a new line (and often a new page) per element. |
| P2 | Usually the same speed. GCC 14 and Clang 18 compile this to a branchless `cmov` even at `-O1`, and GCC vectorizes it at `-O3` (verified). With the branch forced to stay (`-fno-if-conversion -fno-tree-vectorize`), unsorted data is 7.9× slower. | The branch-prediction effect is real, but modern compilers usually remove the branch for a body this simple. Interview answer: explain the mechanism, then say you'd check the assembly. |
| P3 | Vector far faster: 10× vs a list whose nodes happen to be allocated in order, 436× vs a list with scattered nodes (both measured) | Contiguous, prefetchable; the list chases pointers to scattered nodes. |
| P4 | Much closer than the 16× difference in work: stride-16 measured only 2.3× faster | Both load every cache line; memory bandwidth, not instruction count, is the limit. |
| P5 | Four accumulators \~3–4× faster when the data is in cache (4.1× measured on 32 KB); only 1.4× on an 80 MB array, where memory bandwidth is the limit | One accumulator serializes on FP-add latency; four run in parallel. |
| P6 | Separate vector \~8× less memory traffic, typically several times faster | AoS loads 64 bytes per 8 useful bytes. |

### Spot the performance bug

- **B1:** 4096 separate heap allocations and an extra indirection per row; rows aren't contiguous with each other. Use one `std::vector<double>` of size n² with index math, or `std::mdspan`.
- **B2:** O(log n) pointer chasing through tree nodes on every message, and allocation on insert. Use an open-addressing hash map or a direct index from order ID to a pool slot.
- **B3:** Column-order traversal with a 4096-byte stride: every access hits a new line and the same cache sets, causing conflict misses. Swap the loops.
- **B4:** False sharing: all eight counters share one or two cache lines. Pad each to a cache line or keep counters thread-local.
- **B5:** Unpredictable indirect calls on every element. Group handlers by type, or use `std::variant`/templates so calls can be inlined.

### Exercise hints

- **E1:** Generate the permutation with Sattolo's algorithm so the chain visits every element in one cycle, and make each element a full cache line apart to defeat spatial prefetch.
- **E5:** i-k-j makes the inner loop stream along rows of both B and C; blocking keeps tiles of A, B and C in L1/L2. Expect an order of magnitude between naive and blocked.

### Interview questions

1. Roughly 1 ns, 3–5 ns, 10–20 ns, and about 100 ns.
2. The unit of transfer between memory and cache (64 or 128 bytes). Pack data accessed together into the same lines, keep hot data small, and separate data written by different threads.
3. Too many addresses mapping to one cache set evict each other despite free capacity elsewhere. Power-of-two strides and array dimensions map to the same sets; pad dimensions to break the pattern.
4. A cache of virtual-to-physical translations. Huge pages help when the working set is large and accessed randomly (order books, hash tables, big arrays), cutting TLB misses.
5. About 15–20 cycles of lost work. Make branches predictable (sort, separate cases), use branchless code, and move rare cases out of hot loops.
6. Each node is a separate allocation, so traversal is a chain of dependent cache misses the prefetcher can't predict, plus extra memory for pointers.
7. Array of structures stores each object's fields together; structure of arrays stores each field contiguously. If a loop reads one field of many objects, SoA loads only that field.
8. Memory attached to another socket is slower to access. Pin the critical threads and their memory to one node, ideally the one the NIC is attached to.
9. Usually no, or leave sibling threads idle on critical cores, since they compete for execution units and caches and add jitter.
10. Break dependency chains (multiple accumulators, independent work), avoid unpredictable branches, and give the CPU independent loads so misses overlap.
11. On regular loops over contiguous data with independent iterations. Blockers: possible pointer aliasing, loop-carried dependencies, function calls, complex control flow, and strict FP ordering for reductions.
