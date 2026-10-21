:::exercise{#E1 level=warm-up title="Map your memory hierarchy"}
Write a pointer-chasing benchmark: a random cyclic permutation over buffers from 4 KB to 1 GB, measure ns per load, and plot latency vs size. Identify L1, L2, (L3) and DRAM on your Mac, and on an x86 cloud VM if you can.
::hint
Generate the permutation with Sattolo's algorithm so the chain visits every element in one cycle, and make each element a full cache line apart to defeat spatial prefetch.
:::

:::exercise{#E2 level=standard title="Branch prediction"}
Implement P2. Then write a branchless version (`sum += (x >= 128) * x;` or a mask), compare times on sorted and unsorted data, and check the assembly for `csel`/`cmov` and vector instructions at `-O2` and `-O3`.
:::

:::exercise{#E3 level=standard title="SoA vs AoS"}
Implement P6 with both layouts and also with a 16-byte `Order`. Explain results in terms of bytes loaded per useful byte.
:::

:::exercise{#E4 level=standard title="Vectorization"}
Write a dot product, confirm it vectorizes using the compiler remarks, break vectorization with possibly-aliasing pointers, fix it with `__restrict`, then write it with `std::simd` (or NEON intrinsics) and compare.
:::

:::exercise{#E5 level=interview-hard title="Matrix multiply"}
Implement 1024×1024 `double` multiplication in i-j-k order, i-k-j order, and with blocking (tiling) for cache. Report GFLOP/s for each and explain the differences.
::hint
i-k-j makes the inner loop stream along rows of both B and C; blocking keeps tiles of A, B and C in L1/L2. Expect an order of magnitude between naive and blocked.
:::

:::exercise{#E6 level=standard title="Accumulators"}
Implement P5 with 1, 2, 4 and 8 accumulators and find where speedup stops; relate it to the FP add latency and throughput of your core.
:::
