:::question{#Q1}
How would you design a thread pool? What are the trade-offs between one queue and per-worker queues?
::answer
Workers, a task queue, submission returning a handle, and shutdown. One queue is simple and fair but contended; per-worker queues scale better and keep caches warm but need stealing for balance.
:::

:::question{#Q2}
How does work stealing work, and why do owners use LIFO and thieves FIFO?
::answer
Idle workers take tasks from others' deques. Owners take newest tasks (still in cache, small); thieves take the oldest (likely the biggest chunk of remaining work, reducing future steals) from the other end, minimizing conflicts.
:::

:::question{#Q3}
What are the limitations of `std::future`?
::answer
Blocking-only, single `get()`, no continuations, no composition, no cancellation, and `std::async`'s blocking destructor.
:::

:::question{#Q4}
Explain senders and receivers. What does "lazy" mean here?
::answer
Senders describe asynchronous work and its completion signatures; receivers consume results through value, error and stopped channels. Lazy: composing senders builds a description; nothing runs until it's connected and started.
:::

:::question{#Q5}
What is structured concurrency?
::answer
Concurrent work is scoped: a parent can't finish until its children finish or are cancelled, so lifetimes nest like function calls and no work leaks.
:::

:::question{#Q6}
How many threads should a pool have?
::answer
About one per core for CPU-bound work, minus cores reserved for latency-critical threads; more only if tasks block.
:::

:::question{#Q7}
How do you handle blocking I/O in a pool?
::answer
Separate pools for blocking work, asynchronous I/O with completion callbacks or coroutines, or an event loop (:mod[networking]).
:::

:::question{#Q8}
Compare an M:N scheduler of lightweight user-space threads with a C++ thread pool.
::answer
An M:N runtime multiplexes many lightweight threads, each with a small stack, onto a few OS threads with per-thread run queues and stealing, preempts them, and parks them on blocking calls so the OS thread runs something else. A C++ pool runs tasks to completion, can't preempt, and blocking ties up a worker unless you use coroutines or async I/O.

> **Coming from Go?** That M:N runtime is Go's: goroutines on per-processor (P) run queues, stolen between Ps, preempted, and parked when they block.
:::

:::question{#Q9}
Why do trading hot paths avoid thread pools entirely?
::answer
Scheduling adds queueing delay, wakeup latency and cache disruption, and introduces jitter. Pinned busy-polling threads give the lowest and most predictable latency.
:::
