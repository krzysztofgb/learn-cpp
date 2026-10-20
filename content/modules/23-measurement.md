# Module 23: Measurement

In trading, a claim about latency without a measurement is worthless, and a measurement without the right methodology is worse. Interviewers ask how you'd measure latency, what percentiles mean, and what goes wrong with microbenchmarks.

## Notes

### 23.1 What to measure

Latency is a distribution, not a number. Report p50, p99, p99.9 and max, plus throughput. The mean hides the tail, and in trading the tail is where money is lost: a strategy that's fast 99% of the time and slow during bursts is slow exactly when it matters. Never average percentiles from different runs; merge the underlying histograms.

### 23.2 Histograms

Storing every sample is expensive; a fixed set of buckets isn't. HdrHistogram uses log-linear buckets: logarithmic magnitude ranges, each split linearly, giving a bounded relative error (e.g. 0.1%) across a huge range with a few KB of memory and O(1) recording. Histograms from many threads or runs can be added together exactly.

### 23.3 Coordinated omission

A load generator that waits for each response before sending the next (closed loop) slows down exactly when the system stalls, so it records one slow sample instead of the hundreds of requests that would have arrived during the stall. The reported p99 can look perfect while real users suffer. Fix: send on a fixed schedule (open loop) and measure from the *intended* send time, or correct the histogram for missed intervals (HdrHistogram supports this).

### 23.4 Clocks and timers

| Source | Resolution and cost | Notes |
| --- | --- | --- |
| `std::chrono::steady_clock` | \~20–30 ns per call on Linux (vDSO, no syscall) | Portable, monotonic |
| `rdtsc` / `rdtscp` (x86) | \~6–25 ns, cycle-level | Needs invariant TSC; convert with a calibrated frequency; `rdtsc` can execute out of order, so fence it (`lfence`) or use `rdtscp` |
| `cntvct_el0` (ARM) | 24 MHz on M1 and M2 (hw.tbfrequency), so \~42 ns per tick. Run sysctl hw.tbfrequency on your machine: newer chips on recent macOS can report a different rate | Too coarse for single short operations on a Mac; measure batches |
| `mach_absolute_time` (macOS) | Same underlying counter |  |
| NIC hardware timestamps | Nanoseconds, at the wire | Used for production tick-to-trade measurement |

Timer overhead and resolution set a floor: to time an operation shorter than about 10× the timer cost, time a batch and divide.

### 23.5 Microbenchmark pitfalls

- **Dead code elimination:** if the result isn't used, the compiler deletes the work. Use `benchmark::DoNotOptimize(x)` and `benchmark::ClobberMemory()` (Google Benchmark).
- **Constant folding and hoisting:** inputs known at compile time, or loop-invariant computations, get precomputed.
- **Unrealistically warm state:** the same few inputs keep caches hot and train the branch predictor perfectly. Use realistic, varied inputs (replayed market data).
- **Unrealistically cold state:** the opposite mistake, measuring including first-touch page faults when production is warm.
- **Frequency scaling and thermal throttling:** laptops especially. Pin, warm up, repeat, and watch variance.
- **Measuring the harness:** printing, allocation or locking inside the timed region.
- **Noise:** report medians and spread across repetitions (`--benchmark_repetitions`), not a single run.

### 23.6 Profilers and counters

- **Linux `perf`:** `perf stat` for counters (cycles, instructions, IPC, cache misses, branch misses), `perf record`/`report` for sampling profiles, flame graphs from `perf script`, and `perf c2c` for false sharing.
- **Top-down analysis** (Intel VTune, `perf stat --topdown`): splits pipeline slots into frontend-bound, backend-bound (memory or core), bad speculation and retiring, which tells you what kind of fix to look for.
- **IPC** (instructions per cycle): well above 1 means the core is busy doing work; well below 1 usually means waiting on memory or recovering from mispredictions.
- **macOS:** Instruments (Time Profiler, CPU Counters), `xctrace` from the command line, and `sample`.

### 23.7 Production

Software timestamps inside the process miss the kernel and NIC. Firms measure tick-to-trade wire-to-wire: a network tap or switch port mirror captures both the inbound market data packet and the outbound order packet with hardware timestamps, and the difference is the true reaction time.

## Predict

**P1** What does Google Benchmark report for this, and why?

```cpp kind=fragment run=none
static void BM_Sum(benchmark::State& state) {
    for (auto _ : state) {
        int x = 0;
        for (int i = 0; i < 1000; ++i) x += i;
    }
}
```

**P2** 100 latency samples: 98 are 10 µs and 2 are 1000 µs. Give the mean, p50 and p99 (nearest-rank).

**P3** A closed-loop client sends one request per millisecond for 10 s. Once, the server stalls for 1 s. The recorded p99 looks normal. What is the true p99 if requests had been sent on schedule?

**P4** On your Mac you time a 5 ns function with two `mach_absolute_time()` calls around a single invocation. What values do you see?

**P5** `perf stat` shows 4 billion cycles and 1 billion instructions for a hot loop. What does that suggest?

## Spot the methodology bug

**B1** A parser benchmark parses the same 200-byte message 10M times.

**B2** Latency is measured with `std::chrono::system_clock`.

**B3** Each of 5 runs reports a p99; the final report averages them.

**B4** The timed region includes `std::cout << latency << '\n';` for each sample.

**B5** Benchmarks run on a laptop on battery, alternating with a video call.

**B6** A cache-sensitive benchmark allocates a fresh 1 GB buffer inside each timed iteration.

## Exercises

**E1 ★ Google Benchmark basics.** Benchmark `vector::push_back` of 1M ints with and without `reserve`. Use `DoNotOptimize`, `Range`, and `--benchmark_repetitions=10`, and report median and coefficient of variation.

**E2 ★★ Latency harness.** Record per-operation latency of your order book (Module 22) into a histogram and print p50, p99, p99.9 and max. Time batches if the timer is too coarse, and explain the trade-off.

**E3 ★★ Build a histogram.** Implement a log-linear histogram (HDR-style) with configurable precision, O(1) record, percentile query and exact merge. Test it against sorting all samples.

**E4 ★★ Coordinated omission demo.** Write a fake server function with a 1% chance of a 5 ms stall. Measure it with a closed-loop and an open-loop generator, and compare the reported percentiles.

**E5 ★★ Timer costs.** Measure call overhead and resolution of `steady_clock::now()`, `mach_absolute_time()` and a direct `cntvct_el0` read on your Mac (and `rdtsc` on an x86 machine if available).

**E6 ★★★ Profile and fix.** Profile your order book or ITCH decoder with Instruments (or `perf` on Linux), produce a flame graph, identify the top three costs, fix one, and show before/after histograms.

## Interview questions

1. How would you measure the latency of a function? Of a whole system?
2. Which statistics do you report, and why not just the mean?
3. What is coordinated omission?
4. What are the common microbenchmark pitfalls?
5. What's tricky about using `rdtsc`?
6. Which hardware counters would you look at first, and what do they tell you?
7. What does low IPC suggest?
8. How is tick-to-trade measured in production?
9. How do you combine latency results from several machines or runs?
10. How do you make benchmark results reproducible?

## Answer key

### Predict

| # | Answer | Why |
| --- | --- | --- |
| P1 | Close to 0 ns | `x` is never used, so the loop is deleted. Add `benchmark::DoNotOptimize(x)`. |
| P2 | Mean 29.8 µs, p50 10 µs, p99 1000 µs | The mean describes no actual request; the 99th sorted value is 1000. |
| P3 | Roughly 900 ms | About 1000 requests would have arrived during the stall with delays spread from \~0 to 1 s, about 9% of all requests, so p99 lands near the top of that range. |
| P4 | 0 or one tick (\~42 ns) | On an M1 or M2 the counter runs at 24 MHz (check sysctl hw.tbfrequency on yours). |
| P5 | IPC 0.25: likely stalled on memory (or mispredictions) | A compute-bound loop would show IPC above 1. |

### Spot the methodology bug

- **B1:** The same input keeps everything in L1 and trains the branch predictor; real streams vary. Replay a realistic mix of messages.
- **B2:** Wall-clock time can jump; use `steady_clock` or a cycle counter.
- **B3:** Averaging percentiles is mathematically meaningless; merge the histograms and compute percentiles once.
- **B4:** I/O inside the timed region dominates and adds jitter; record into a preallocated histogram and print later.
- **B5:** Power management and interference produce noisy, unrepresentative numbers. Use a quiet, plugged-in machine (ideally an isolated Linux server), and repeat.
- **B6:** Measures page faults and allocation, not the algorithm. Allocate and prefault once outside the timed loop (unless cold start is what you want to measure).

### Exercise hints

- **E2:** Timing batches of 64 operations hides individual outliers, so report both: per-batch histograms for fine resolution, and occasional individually timed operations for the tail.
- **E4:** In the open-loop generator, compute each request's latency as completion time minus scheduled send time, even if the generator itself fell behind.

### Interview questions

1. Function: many timed calls with realistic inputs, a steady clock or cycle counter, results in a histogram, pinned and warmed. System: timestamps at entry and exit points, ideally hardware timestamps at the NIC or a network tap, under realistic open-loop load.
2. p50, p99, p99.9, max and throughput. The mean is dominated by outliers yet hides how often they occur; tails drive outcomes in trading.
3. When the measuring system waits on the measured system, stalls reduce the number of samples taken during the stall, so the slow period is under-recorded.
4. Dead-code elimination, constant folding, unrealistically warm caches and predictors, timer overhead, frequency scaling, measuring the harness, and too few repetitions.
5. Needs an invariant TSC (constant rate across power states), conversion from cycles to time, ordering fences since it can execute out of order, and care with cross-core comparisons and virtualization.
6. Cycles, instructions (IPC), cache misses at each level, branch misses, and TLB misses; they tell you whether you're memory-bound, mispredicting, or compute-bound.
7. The core is mostly waiting, usually for memory (cache or TLB misses), sometimes for mispredicted branches being flushed.
8. By capturing inbound and outbound packets with hardware timestamps on a tap or mirrored switch port and matching each order to the market data that triggered it.
9. Merge histograms (add bucket counts) and compute percentiles from the merged result.
10. Fixed hardware and OS configuration, pinned threads, disabled frequency scaling, warm-up, recorded inputs, multiple repetitions with variance reported, and versioned benchmark code and flags.
