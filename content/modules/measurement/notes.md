### What to measure

Latency is a distribution, not a number. Report p50, p99, p99.9 and max, plus throughput. The mean hides the tail, and in trading the tail is where money is lost: a strategy that's fast 99% of the time and slow during bursts is slow exactly when it matters. Never average percentiles from different runs; merge the underlying histograms.

### Histograms

Storing every sample is expensive; a fixed set of buckets isn't. HdrHistogram uses log-linear buckets: logarithmic magnitude ranges, each split linearly, giving a bounded relative error (e.g. 0.1%) across a huge range with a few KB of memory and O(1) recording. Histograms from many threads or runs can be added together exactly.

### Coordinated omission

A load generator that waits for each response before sending the next (closed loop) slows down exactly when the system stalls, so it records one slow sample instead of the hundreds of requests that would have arrived during the stall. The reported p99 can look perfect while real users suffer. Fix: send on a fixed schedule (open loop) and measure from the *intended* send time, or correct the histogram for missed intervals (HdrHistogram supports this).

### Clocks and timers

| Source | Resolution and cost | Notes |
| --- | --- | --- |
| `std::chrono::steady_clock` | \~20–30 ns per call on Linux (vDSO, no syscall) | Portable, monotonic |
| `rdtsc` / `rdtscp` (x86) | \~6–25 ns, cycle-level | Needs invariant TSC; convert with a calibrated frequency; `rdtsc` can execute out of order, so fence it (`lfence`) or use `rdtscp` |
| `cntvct_el0` (ARM) | 24 MHz on M1 and M2 (hw.tbfrequency), so \~42 ns per tick. Run sysctl hw.tbfrequency on your machine: newer chips on recent macOS can report a different rate | Too coarse for single short operations on a Mac; measure batches |
| `mach_absolute_time` (macOS) | Same underlying counter |  |
| NIC hardware timestamps | Nanoseconds, at the wire | Used for production tick-to-trade measurement |

Timer overhead and resolution set a floor: to time an operation shorter than about 10× the timer cost, time a batch and divide.

### Microbenchmark pitfalls

- **Dead code elimination:** if the result isn't used, the compiler deletes the work. Use `benchmark::DoNotOptimize(x)` and `benchmark::ClobberMemory()` (Google Benchmark).
- **Constant folding and hoisting:** inputs known at compile time, or loop-invariant computations, get precomputed.
- **Unrealistically warm state:** the same few inputs keep caches hot and train the branch predictor perfectly. Use realistic, varied inputs (replayed market data).
- **Unrealistically cold state:** the opposite mistake, measuring including first-touch page faults when production is warm.
- **Frequency scaling and thermal throttling:** laptops especially. Pin, warm up, repeat, and watch variance.
- **Measuring the harness:** printing, allocation or locking inside the timed region.
- **Noise:** report medians and spread across repetitions (`--benchmark_repetitions`), not a single run.

### Profilers and counters

- **Linux `perf`:** `perf stat` for counters (cycles, instructions, IPC, cache misses, branch misses), `perf record`/`report` for sampling profiles, flame graphs from `perf script`, and `perf c2c` for false sharing.
- **Top-down analysis** (Intel VTune, `perf stat --topdown`): splits pipeline slots into frontend-bound, backend-bound (memory or core), bad speculation and retiring, which tells you what kind of fix to look for.
- **IPC** (instructions per cycle): well above 1 means the core is busy doing work; well below 1 usually means waiting on memory or recovering from mispredictions.
- **macOS:** Instruments (Time Profiler, CPU Counters), `xctrace` from the command line, and `sample`.

### Production

Software timestamps inside the process miss the kernel and NIC. Firms measure tick-to-trade wire-to-wire: a network tap or switch port mirror captures both the inbound market data packet and the outbound order packet with hardware timestamps, and the difference is the true reaction time.
