:::exercise{#E1 level=warm-up title="Basic pool"}
Implement a fixed pool with one mutex-protected queue and `submit(f)` returning `std::future<R>` (via `std::packaged_task`). Support clean shutdown with `std::jthread` and `stop_token`.
:::

:::exercise{#E2 level=standard title="Work stealing"}
Give each worker its own mutex-protected deque; owners use the back, thieves the front. Compare against E1 on a recursive fork-join workload (parallel sum over a large array, splitting until 10K elements).
::hint
With one shared queue, every split contends on one lock; with per-worker deques, most pushes and pops are uncontended and stealing is rare.
:::

:::exercise{#E3 level=standard title="Continuations"}
Implement `Future<T>` and `Promise<T>` with `then(f)` that runs `f` on completion (inline if already complete) and returns `Future<R>`, plus `when_all` for two futures.
::hint
Store the continuation in shared state guarded by a mutex or an atomic state machine; whoever arrives second (value or continuation) runs it.
:::

:::exercise{#E4 level=standard title="Senders"}
Using `stdexec` (via CMake `FetchContent`), build a pipeline on a static thread pool: load three instrument files in parallel with `when_all`, parse each, merge, and `sync_wait` the result. Add cancellation with a stop source.
:::

:::exercise{#E5 level=interview-hard title="Coroutine executor"}
Implement `Task<T>` with symmetric transfer and a `schedule()` awaitable for your E1 pool. Run 1M chained tasks without stack overflow and measure per-task overhead.
::hint
Without symmetric transfer, each completed task resumes its awaiter from inside the previous frame's call stack, so a million-long chain overflows the stack.
:::

:::exercise{#E6 level=interview-hard title="Chase-Lev deque"}
Implement the lock-free work-stealing deque with a growable circular array and correct memory orders (Le et al., "Correct and Efficient Work-Stealing for Weak Memory Models"). Swap it into E2.
:::
