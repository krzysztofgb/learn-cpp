### What to measure

Latency is a distribution, not a number. Report p50, p99, p99.9 and max, plus throughput. The mean hides the tail, and in trading the tail is where money is lost: a strategy that's fast 99% of the time and slow during bursts is slow exactly when it matters. A few huge outliers also drag the mean to a value that no actual request took.

The *p*-th percentile is the value below which *p*% of samples fall. The simplest definition, *nearest rank*, sorts the N samples and takes the one at position ⌈p/100 × N⌉ (1-based): with 100 samples, p50 is the 50th and p99 the 99th. Other definitions interpolate between neighbours; on large samples they agree closely.

Percentiles don't combine arithmetically: the average of five runs' p99s is not the p99 of all the samples, and neither is any other formula over the percentiles alone. Never average percentiles from different runs or machines; merge the underlying histograms and compute percentiles once.

### Histograms

Storing every sample is expensive; a fixed set of buckets isn't. HdrHistogram uses log-linear buckets: logarithmic magnitude ranges (one per power of two), each split linearly into 2^k sub-buckets, giving a bounded relative error (e.g. 0.1%) across a huge range with a few KB of memory. Recording is O(1): the position of the value's highest set bit picks the magnitude range, and the next k bits pick the sub-bucket. A percentile query walks the buckets, accumulating counts until it reaches the target rank. Histograms with the same bucket layout, from many threads or runs, merge exactly by adding counts bucket by bucket.

### Coordinated omission

A load generator that waits for each response before sending the next (closed loop) slows down exactly when the system stalls, so it records one slow sample instead of the hundreds of requests that would have arrived during the stall. The reported p99 can look perfect while real users suffer.

To estimate what was missed: with requests scheduled every *i* and a stall of length *T*, about *T*/*i* requests would have arrived during the stall, and their delays would have been spread evenly from about *T* (the first) down to about 0 (the last). Compare that count with the total to see how far into the tail the stall reaches.

Fix: send on a fixed schedule (open loop) and measure each request from its *intended* send time, even when the generator itself fell behind, or correct the histogram for missed intervals (HdrHistogram supports this).

### Clocks and timers

| Source | Resolution and cost | Notes |
| --- | --- | --- |
| `std::chrono::steady_clock` | \~20–30 ns per call on Linux (vDSO, no syscall) | Portable, monotonic |
| `rdtsc` / `rdtscp` (x86) | \~6–25 ns, cycle-level | Needs invariant TSC; convert with a calibrated frequency; `rdtsc` can execute out of order, so fence it (`lfence`) or use `rdtscp` |
| `cntvct_el0` (ARM) | Fixed-rate counter; 24 MHz on Apple M1 and M2, so \~42 ns per tick (macOS reports the rate as `sysctl hw.tbfrequency`; newer chips on recent macOS can report a different rate) | Too coarse to time a single short operation at 24 MHz; measure batches |
| `mach_absolute_time` (macOS) | Same underlying counter on Apple Silicon |  |
| `QueryPerformanceCounter` (Windows) | Typically 10 MHz (100 ns ticks); `QueryPerformanceFrequency` gives the rate | What `steady_clock` uses on MSVC |
| NIC hardware timestamps | Nanoseconds, at the wire | Used for production tick-to-trade measurement |

- **Use a monotonic clock.** `std::chrono::system_clock` is wall-clock time: NTP or an administrator can step it forward or backward, so a difference between two readings can be wrong or negative. `steady_clock` never goes backward and is the right clock for intervals.
- **TSC caveats:** older CPUs changed the TSC rate with frequency scaling (invariant TSC fixes that); counters on different cores or sockets may not be perfectly synchronized, so compare readings from one core where you can; and under virtualization the hypervisor may emulate or offset the TSC.
- **Timer overhead and resolution set a floor:** to time an operation shorter than about 10× the timer cost or tick, time a batch and divide. A batch hides the variation between individual operations, so pair batched timings with occasional individually timed operations if you need the tail.

*Further reading:* [Timing your code](https://www.learncpp.com/cpp-tutorial/timing-your-code/), [std::chrono::steady_clock](https://en.cppreference.com/w/cpp/chrono/steady_clock)

### Microbenchmark pitfalls

- **Dead code elimination:** if the result isn't used, the compiler deletes the work (the as-if rule lets it remove anything with no observable effect). Use `benchmark::DoNotOptimize(x)` and `benchmark::ClobberMemory()` (Google Benchmark).
- **Constant folding and hoisting:** inputs known at compile time, or loop-invariant computations, get precomputed.
- **Unrealistically warm state:** the same few inputs keep caches hot and train the branch predictor perfectly. Use realistic, varied inputs (replayed market data).
- **Unrealistically cold state:** the opposite mistake, measuring including first-touch page faults when production is warm. Allocate and prefault buffers outside the timed region.
- **Frequency scaling, thermal throttling and power management:** laptops especially, and on battery most of all. Benchmark on a plugged-in, otherwise idle machine; pin, warm up, repeat, and watch variance.
- **Measuring the harness:** printing, allocation or locking inside the timed region. Record into a preallocated array or histogram and print after the run.
- **Noise:** report medians and spread across repetitions, not a single run.

### Google Benchmark

```cpp run=none note="Needs the Google Benchmark library, which the in-browser compiler doesn't have."
static void BM_PushBack(benchmark::State& state) {
    for (auto _ : state) {                       // timed loop
        std::vector<int> v;
        for (int i = 0; i < state.range(0); ++i) v.push_back(i);
        benchmark::DoNotOptimize(v.data());      // keep the work observable
    }
}
BENCHMARK(BM_PushBack)->Range(1 << 10, 1 << 20);  // runs for several sizes in that range
BENCHMARK_MAIN();
```

The library picks the iteration count, so each reported time is per iteration of the `for (auto _ : state)` loop. `->Range(lo, hi)` (or `->Arg(n)`) runs the benchmark once per argument, read inside with `state.range(0)`. `--benchmark_repetitions=10` repeats the whole measurement and adds mean, median, standard deviation and coefficient of variation (`cv`, the standard deviation divided by the mean) rows; a CV of a few percent or less suggests a stable setup.

### Profilers and counters

- **Linux `perf`:** `perf stat` for counters (cycles, instructions, IPC, cache misses, branch misses, `page-faults`), `perf record`/`report` for sampling profiles, flame graphs from `perf script` (Brendan Gregg's FlameGraph scripts) or the hotspot GUI, and `perf c2c` for false sharing.
- **Top-down analysis** (Intel VTune, `perf stat --topdown`): splits pipeline slots into frontend-bound, backend-bound (memory or core), bad speculation and retiring, which tells you what kind of fix to look for.
- **IPC** (instructions per cycle): instructions retired divided by cycles. Modern cores can retire 4 or more per cycle; well above 1 means the core is busy doing work; well below 1 usually means waiting on memory (cache or TLB misses) or recovering from mispredictions.
- **macOS:** Instruments (Time Profiler, CPU Counters), `xctrace` from the command line, and `sample`.
- **Windows:** Intel VTune or AMD uProf for counters, Windows Performance Recorder and Analyzer (ETW) or the Visual Studio profiler for sampling.

### Production

Software timestamps inside the process miss the kernel and NIC. Firms measure tick-to-trade wire-to-wire: a network tap or switch port mirror captures both the inbound market data packet and the outbound order packet with hardware timestamps, and each order is matched to the market data that triggered it; the difference is the true reaction time.
