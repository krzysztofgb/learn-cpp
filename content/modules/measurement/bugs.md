:::bug{#B1 findings=defined-bug}
A parser benchmark parses the same 200-byte message 10M times.
::answer
A methodology bug (defined behavior): the same input keeps everything in L1 and trains the branch predictor; real streams vary. Replay a realistic mix of messages.
:::

:::bug{#B2 findings=defined-bug}
Latency is measured with `std::chrono::system_clock`.
::answer
A methodology bug (defined behavior): wall-clock time can jump; use `steady_clock` or a cycle counter.
:::

:::bug{#B3 findings=defined-bug}
Each of 5 runs reports a p99; the final report averages them.
::answer
A methodology bug (defined behavior): averaging percentiles is mathematically meaningless; merge the histograms and compute percentiles once.
:::

:::bug{#B4 findings=defined-bug}
The timed region includes `std::cout << latency << '\n';` for each sample.
::answer
A methodology bug (defined behavior): I/O inside the timed region dominates and adds jitter; record into a preallocated histogram and print later.
:::

:::bug{#B5 findings=defined-bug}
Benchmarks run on a laptop on battery, alternating with a video call.
::answer
A methodology bug (defined behavior): power management and interference produce noisy, unrepresentative numbers. Use a quiet, plugged-in machine (ideally an isolated Linux server), and repeat.
:::

:::bug{#B6 findings=defined-bug}
A cache-sensitive benchmark allocates a fresh 1 GB buffer inside each timed iteration.
::answer
A methodology bug (defined behavior): it measures page faults and allocation, not the algorithm. Allocate and prefault once outside the timed loop (unless cold start is what you want to measure).
:::
