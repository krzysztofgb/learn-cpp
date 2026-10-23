:::predict{#P1}
What does Google Benchmark report for this, and why?

```cpp run=none
static void BM_Sum(benchmark::State& state) {
    for (auto _ : state) {
        int x = 0;
        for (int i = 0; i < 1000; ++i) x += i;
    }
}
```
::choices
- [ ] About 1000 ns: one per addition
- [x] Close to 0 ns
- [ ] A few hundred ns: the loop is vectorized
- [ ] It fails to compile: `_` is unused
::answer
Close to 0 ns

`x` is never used, so the loop is deleted. Add `benchmark::DoNotOptimize(x)`.
:::

:::predict{#P2}
100 latency samples: 98 are 10 µs and 2 are 1000 µs. Give the mean, p50 and p99 (nearest-rank).
::choices
- [ ] Mean 10 µs, p50 10 µs, p99 1000 µs
- [x] Mean 29.8 µs, p50 10 µs, p99 1000 µs
- [ ] Mean 29.8 µs, p50 10 µs, p99 10 µs
- [ ] Mean 505 µs, p50 10 µs, p99 1000 µs
::answer
Mean 29.8 µs, p50 10 µs, p99 1000 µs

The mean describes no actual request; the 99th sorted value is 1000.
:::

:::predict{#P3}
A closed-loop client sends one request per millisecond for 10 s. Once, the server stalls for 1 s. The recorded p99 looks normal. What is the true p99 if requests had been sent on schedule?
::choices
- [ ] About 1 ms: the recorded p99 is right
- [ ] About 100 ms
- [ ] About 500 ms: the average stall delay
- [x] Roughly 900 ms
::answer
Roughly 900 ms

About 1000 requests would have arrived during the stall with delays spread from \~0 to 1 s, about 10% of all requests, so p99 lands near the top of that range.
:::

:::predict{#P4}
On an Apple Silicon Mac you time a 5 ns function with two `mach_absolute_time()` calls around a single invocation. What values do you see?
::choices
- [ ] About 5 ns each time
- [x] 0 or one tick (\~42 ns)
- [ ] Around 1 µs: each call is a syscall
- [ ] Occasionally a negative value
::answer
0 or one tick (\~42 ns)

On an M1 or M2 the counter runs at 24 MHz (check sysctl hw.tbfrequency on yours).
:::

:::predict{#P5}
`perf stat` shows 4 billion cycles and 1 billion instructions for a hot loop. What does that suggest?
::choices
- [ ] IPC 4: the loop is well vectorized
- [x] IPC 0.25: likely stalled on memory or mispredictions
- [ ] IPC 0.25: the loop is compute-bound
- [ ] Nothing: cycles and instructions are not comparable
::answer
IPC 0.25: likely stalled on memory (or mispredictions)

A compute-bound loop would show IPC above 1.
:::
