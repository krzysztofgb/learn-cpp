:::question{#Q1}
What would you avoid on a latency-critical path, and why?
::answer
See table 22.1: allocation, syscalls, locks, exceptions, virtual calls, unpredictable branches, pointer chasing, inline logging, string keys and node-based containers.
:::

:::question{#Q2}
How do you avoid heap allocation after startup?
::answer
Preallocate pools and arenas sized for peak load at startup, use fixed-capacity containers and `pmr` with a null upstream, `reserve` everything, and test with an allocation counter.
:::

:::question{#Q3}
Design a logger that adds only nanoseconds to the hot path.
::answer
Hot thread copies a compact binary record into a preallocated SPSC ring and never formats or blocks; a background thread formats and writes. If the ring is full, drop and count rather than block.
:::

:::question{#Q4}
What does `-ffast-math` do, and why is it dangerous?
::answer
Lets the compiler reorder and simplify floating-point math as if it were real arithmetic and assume no NaN/infinity. Results change, NaN checks vanish, and it applies to whole translation units.
:::

:::question{#Q5}
What are LTO and PGO, and what gains can you expect?
::answer
LTO optimizes across translation units (inlining, devirtualization). PGO uses runtime profiles for layout, inlining and branch decisions. Gains of roughly 5–15% are common, more for branchy code.
:::

:::question{#Q6}
Why can inlining hurt performance?
::answer
It grows code size, pushing hot code out of the instruction cache, and can increase register pressure. Keep cold paths out of line.
:::

:::question{#Q7}
Why warm up a trading system, and how?
::answer
Caches, TLB, branch predictors, page tables and lazy binding all start cold, so the first events are slow. Warm by prefaulting memory and running synthetic messages through the real code path.
:::

:::question{#Q8}
What OS and hardware settings matter for low latency?
::answer
Core isolation, thread pinning, IRQ affinity, huge pages, `mlock`, disabling deep C-states and frequency scaling, disabling SMT or idling siblings, and kernel bypass networking.
:::

:::question{#Q9}
Busy-polling vs blocking: trade-offs?
::answer
Busy-polling gives the lowest, most consistent latency but burns a whole core; blocking saves CPU but adds microseconds of wakeup latency and jitter.
:::

:::question{#Q10}
Walk me through a fast order book design.
::answer
See 22.6: pooled orders, ID map, intrusive per-level lists, levels in an array or sorted vector, aggregate quantities, no allocation.
:::

:::question{#Q11}
Why use indices instead of pointers?
::answer
Half the memory (32-bit), better cache density, stable across reallocation and process boundaries, and easier to validate.
:::
