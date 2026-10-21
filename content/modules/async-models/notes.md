### Thread pools

- **Single shared queue:** simple, fair, but every submit and take contends on one lock or atomic.
- **Per-worker queues with work stealing:** each worker pushes and pops its own deque at the bottom (LIFO, cache-hot); idle workers steal from the top of others' deques (FIFO, oldest and usually largest tasks). The Chase-Lev deque makes the owner's operations nearly free. Go's runtime uses the same idea: per-processor run queues with stealing.
- **Sizing:** CPU-bound work wants about one thread per core. Blocking I/O inside a pool starves it; give blocking work its own pool, or use asynchronous I/O.
- **Deadlock risk:** a task that blocks waiting for another task in the same pool can deadlock once all workers are blocked the same way.
- **Shutdown:** stop accepting work, signal workers (`stop_token`), wake sleepers, join.

### Futures and their limits

`std::future` supports only blocking `get()` and `wait()`; there's no `.then()` continuation, no composition (`when_all`), and no cancellation. `get()` may be called once (calling it on an invalid future is UB); `std::shared_future` allows many. A destroyed `std::promise` that never set a value makes `get()` throw `std::future_error` with `broken_promise`. These limits are why libraries built their own futures, and why the committee standardized senders.

### `std::execution` (C++26, P2300)

Senders describe work lazily; nothing runs until a sender is connected to a receiver and started.

- A **scheduler** represents an execution context (a thread pool, an event loop); `schedule(sch)` returns a sender that completes on it.
- A **sender** completes through one of three channels: `set_value(args...)`, `set_error(e)` or `set_stopped()`.
- Algorithms compose senders: `just(v)`, `then(f)`, `let_value(f)` (f returns a sender), `when_all(s1, s2)`, `starts_on(sch, s)`, `continues_on(s, sch)`, `sync_wait(s)` to block for a result.
- It's *structured concurrency*: child work can't outlive the scope that started it, and cancellation propagates through stop tokens.

NVIDIA's `stdexec` is the reference implementation, usable today with C++20.

### Coroutines on executors

A coroutine `Task<T>` becomes asynchronous when awaiting a scheduler: `co_await pool.schedule();` suspends and resumes on a pool thread. Use symmetric transfer (returning the next `coroutine_handle` from `await_suspend`) when one coroutine completes and resumes its awaiter, to avoid unbounded stack growth. Propagate cancellation through `std::stop_token`. Watch lifetimes: everything a coroutine references must outlive every suspension point.

### What the hot path does instead

Critical threads are pinned to isolated cores and run a tight loop: poll the NIC or a queue, process, repeat. There's no thread switch, no scheduler, and no wakeup latency. Hand-offs to other threads use SPSC queues. Async frameworks are used around that core, not inside it.
