:::question{#Q1}
Lock-free vs wait-free vs blocking?
::answer
Blocking: a stalled thread can stop others. Lock-free: the system as a whole always progresses. Wait-free: every thread progresses within a bound.
:::

:::question{#Q2}
Why isn't lock-free always faster?
::answer
Contended atomic RMWs serialize on cache lines just like locks, CAS loops retry under contention, and reclamation schemes add overhead. A mutex-free design with a single writer usually wins.
:::

:::question{#Q3}
Explain the ABA problem and two solutions.
::answer
A CAS succeeds because a value returned to its old bit pattern even though the state changed. Fix with version tags (double-width CAS) or by preventing reuse through safe reclamation.
:::

:::question{#Q4}
Compare hazard pointers, epoch-based reclamation and RCU.
::answer
Hazard pointers: per-pointer protection, bounded memory, costlier reads. Epochs: very cheap reads, unbounded garbage if a thread stalls. RCU: near-free readers, writers wait for grace periods; best for read-mostly data.
:::

:::question{#Q5}
Implement an SPSC queue on the whiteboard and justify every memory order.
::answer
See :sec[lock-free-programming/spsc-ring-buffer]: each side loads its own index relaxed, the other side's with acquire, and publishes its own with release after touching the slot.
:::

:::question{#Q6}
How would you make your SPSC queue faster?
::answer
Cache the other side's index, pad indices and buffer to separate cache lines, use power-of-two masking, batch pushes and pops (publish several at once), and pin threads to cores sharing a cache.
:::

:::question{#Q7}
What is false sharing, how do you detect it, and how do you fix it?
::answer
Unrelated variables on one cache line written by different cores, causing coherence traffic. Detect with `perf c2c` on Linux or by experiments with padding; fix by padding/aligning to the cache-line size or making data per-thread.
:::

:::question{#Q8}
How does a seqlock work, and when would you use one?
::answer
A sequence counter: odd while writing. Readers copy the data and retry if the counter was odd or changed. Use it for small, frequently read data with one writer, where readers must never block the writer: top of book, latest prices.
:::

:::question{#Q9}
How would you design an MPMC queue?
::answer
Bounded array with per-slot sequence numbers (Vyukov): CAS on enqueue/dequeue positions, slot sequence tells whether it's ready. Or shard into per-producer SPSC queues with a consumer that polls them all.
:::

:::question{#Q10}
How do you test lock-free code?
::answer
TSan, stress tests on ARM with oversubscription and injected yields, invariant checks, long soak runs, and model checking of the core algorithm.
:::
