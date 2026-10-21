:::question{#Q1}
How would you measure the latency of a function? Of a whole system?
::answer
Function: many timed calls with realistic inputs, a steady clock or cycle counter, results in a histogram, pinned and warmed. System: timestamps at entry and exit points, ideally hardware timestamps at the NIC or a network tap, under realistic open-loop load.
:::

:::question{#Q2}
Which statistics do you report, and why not just the mean?
::answer
p50, p99, p99.9, max and throughput. The mean is dominated by outliers yet hides how often they occur; tails drive outcomes in trading.
:::

:::question{#Q3}
What is coordinated omission?
::answer
When the measuring system waits on the measured system, stalls reduce the number of samples taken during the stall, so the slow period is under-recorded.
:::

:::question{#Q4}
What are the common microbenchmark pitfalls?
::answer
Dead-code elimination, constant folding, unrealistically warm caches and predictors, timer overhead, frequency scaling, measuring the harness, and too few repetitions.
:::

:::question{#Q5}
What's tricky about using `rdtsc`?
::answer
Needs an invariant TSC (constant rate across power states), conversion from cycles to time, ordering fences since it can execute out of order, and care with cross-core comparisons and virtualization.
:::

:::question{#Q6}
Which hardware counters would you look at first, and what do they tell you?
::answer
Cycles, instructions (IPC), cache misses at each level, branch misses, and TLB misses; they tell you whether you're memory-bound, mispredicting, or compute-bound.
:::

:::question{#Q7}
What does low IPC suggest?
::answer
The core is mostly waiting, usually for memory (cache or TLB misses), sometimes for mispredicted branches being flushed.
:::

:::question{#Q8}
How is tick-to-trade measured in production?
::answer
By capturing inbound and outbound packets with hardware timestamps on a tap or mirrored switch port and matching each order to the market data that triggered it.
:::

:::question{#Q9}
How do you combine latency results from several machines or runs?
::answer
Merge histograms (add bucket counts) and compute percentiles from the merged result.
:::

:::question{#Q10}
How do you make benchmark results reproducible?
::answer
Fixed hardware and OS configuration, pinned threads, disabled frequency scaling, warm-up, recorded inputs, multiple repetitions with variance reported, and versioned benchmark code and flags.
:::
