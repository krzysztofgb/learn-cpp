:::bug{#B1}
A parser benchmark parses the same 200-byte message 10M times.
::answer
The same input keeps everything in L1 and trains the branch predictor; real streams vary. Replay a realistic mix of messages.
:::

:::bug{#B2}
Latency is measured with `std::chrono::system_clock`.
::answer
Wall-clock time can jump; use `steady_clock` or a cycle counter.
:::

:::bug{#B3}
Each of 5 runs reports a p99; the final report averages them.
::answer
Averaging percentiles is mathematically meaningless; merge the histograms and compute percentiles once.
:::

:::bug{#B4}
The timed region includes `std::cout << latency << '\n';` for each sample.
::answer
I/O inside the timed region dominates and adds jitter; record into a preallocated histogram and print later.
:::

:::bug{#B5}
Benchmarks run on a laptop on battery, alternating with a video call.
::answer
Power management and interference produce noisy, unrepresentative numbers. Use a quiet, plugged-in machine (ideally an isolated Linux server), and repeat.
:::

:::bug{#B6}
A cache-sensitive benchmark allocates a fresh 1 GB buffer inside each timed iteration.
::answer
Measures page faults and allocation, not the algorithm. Allocate and prefault once outside the timed loop (unless cold start is what you want to measure).
:::
