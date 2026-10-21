:::exercise{#E1 level=warm-up title="Google Benchmark basics"}
Benchmark `vector::push_back` of 1M ints with and without `reserve`. Use `DoNotOptimize`, `Range`, and `--benchmark_repetitions=10`, and report median and coefficient of variation.
:::

:::exercise{#E2 level=standard title="Latency harness"}
Record per-operation latency of your order book (:mod[low-latency-techniques]) into a histogram and print p50, p99, p99.9 and max. Time batches if the timer is too coarse, and explain the trade-off.
::hint
Timing batches of 64 operations hides individual outliers, so report both: per-batch histograms for fine resolution, and occasional individually timed operations for the tail.
:::

:::exercise{#E3 level=standard title="Build a histogram"}
Implement a log-linear histogram (HDR-style) with configurable precision, O(1) record, percentile query and exact merge. Test it against sorting all samples.
:::

:::exercise{#E4 level=standard title="Coordinated omission demo"}
Write a fake server function with a 1% chance of a 5 ms stall. Measure it with a closed-loop and an open-loop generator, and compare the reported percentiles.
::hint
In the open-loop generator, compute each request's latency as completion time minus scheduled send time, even if the generator itself fell behind.
:::

:::exercise{#E5 level=standard title="Timer costs"}
Measure call overhead and resolution of `steady_clock::now()`, `mach_absolute_time()` and a direct `cntvct_el0` read on your Mac (and `rdtsc` on an x86 machine if available).
:::

:::exercise{#E6 level=interview-hard title="Profile and fix"}
Profile your order book or ITCH decoder with Instruments (or `perf` on Linux), produce a flame graph, identify the top three costs, fix one, and show before/after histograms.
:::
