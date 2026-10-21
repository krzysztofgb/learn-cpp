:::question{#Q1}
Give approximate latencies for L1, L2, L3 and main memory.
::answer
Roughly 1 ns, 3–5 ns, 10–20 ns, and about 100 ns.
:::

:::question{#Q2}
What's a cache line, and why does it matter for data structure design?
::answer
The unit of transfer between memory and cache (64 or 128 bytes). Pack data accessed together into the same lines, keep hot data small, and separate data written by different threads.
:::

:::question{#Q3}
What are conflict misses, and when do power-of-two sizes hurt?
::answer
Too many addresses mapping to one cache set evict each other despite free capacity elsewhere. Power-of-two strides and array dimensions map to the same sets; pad dimensions to break the pattern.
:::

:::question{#Q4}
What is the TLB, and when do huge pages help?
::answer
A cache of virtual-to-physical translations. Huge pages help when the working set is large and accessed randomly (order books, hash tables, big arrays), cutting TLB misses.
:::

:::question{#Q5}
What does a branch misprediction cost, and how do you avoid them?
::answer
About 15–20 cycles of lost work. Make branches predictable (sort, separate cases), use branchless code, and move rare cases out of hot loops.
:::

:::question{#Q6}
Why are linked lists slow even when operations are O(1)?
::answer
Each node is a separate allocation, so traversal is a chain of dependent cache misses the prefetcher can't predict, plus extra memory for pointers.
:::

:::question{#Q7}
Explain SoA vs AoS with an example.
::answer
Array of structures stores each object's fields together; structure of arrays stores each field contiguously. If a loop reads one field of many objects, SoA loads only that field.
:::

:::question{#Q8}
What is NUMA, and how does it affect a trading server?
::answer
Memory attached to another socket is slower to access. Pin the critical threads and their memory to one node, ideally the one the NIC is attached to.
:::

:::question{#Q9}
Would you enable hyperthreading on a latency-critical box?
::answer
Usually no, or leave sibling threads idle on critical cores, since they compete for execution units and caches and add jitter.
:::

:::question{#Q10}
What does out-of-order execution mean for how you write loops?
::answer
Break dependency chains (multiple accumulators, independent work), avoid unpredictable branches, and give the CPU independent loads so misses overlap.
:::

:::question{#Q11}
When does SIMD help, and what prevents auto-vectorization?
::answer
On regular loops over contiguous data with independent iterations. Blockers: possible pointer aliasing, loop-carried dependencies, function calls, complex control flow, and strict FP ordering for reductions.
:::
