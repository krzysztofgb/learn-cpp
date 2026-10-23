### Thread pools

- **Single shared queue:** simple, fair, but every submit and take contends on one lock or atomic.
- **Per-worker queues with work stealing:** each worker pushes and pops its own deque at the bottom (LIFO, cache-hot); idle workers steal from the top of others' deques (FIFO, oldest and usually largest tasks). The Chase-Lev deque makes the owner's operations nearly free. Owners take the newest task because its data is still in cache; thieves take the oldest because, in divide-and-conquer work, it's usually the biggest remaining piece, so one steal buys a lot of work, and because working at opposite ends keeps owner and thief from contending.
- **Sizing:** CPU-bound work wants about one thread per core, minus the cores reserved for pinned latency-critical threads. Blocking I/O inside a pool starves it; give blocking work its own pool, or use asynchronous I/O.
- **Deadlock risk:** a task that blocks waiting for another task in the same pool can deadlock once all workers are blocked the same way.
- **Lifetimes:** a submitted task runs later, on another thread, usually after the submitting function has returned. Anything it captures by reference (locals, elements of a local container, `this`) must outlive the task; capture by value or move ownership in.
- **Task storage:** `std::packaged_task` is move-only, so it can't be stored in a `std::function` (which requires a copyable callable). Use `std::move_only_function` (C++23), or hold the task in a `std::shared_ptr` and capture that.
- **Shutdown:** stop accepting work, set a stop flag under the queue's mutex (or request stop through a `stop_token`), `notify_all` so sleeping workers wake and see it, then join. Workers' wait predicate must include the stop condition, or they sleep through it and `join` hangs.

A C++ pool runs each task to completion on one worker: it can't preempt a task, and a task that blocks ties up its worker. An *M:N scheduler* is the other design: a runtime multiplexes many lightweight user-space threads, each with its own small stack, onto a few OS threads, with per-thread run queues and stealing; it can preempt them and, at a blocking call, parks the lightweight thread and runs another on the same OS thread. In C++, stackless coroutines on a pool get you part of the way: a coroutine that `co_await`s I/O frees its worker, but only at the points where it awaits.

> **Coming from Go?** Go's runtime is such an M:N scheduler: goroutines on per-processor run queues with work stealing, preemption, and parking at blocking calls.

### Futures and their limits

A `std::promise` and its `std::future` share a state that holds either a value or an exception: `set_value(v)` stores a value, `set_exception(ptr)` stores an exception, and `get()` returns the value or rethrows the exception. `std::packaged_task<R(Args...)>` owns a callable and a promise; calling the task runs the callable and stores its result (or the exception it threw) in the shared state, which `get_future()` exposes.

`std::future` supports only blocking `get()` and `wait()`; there's no `.then()` continuation, no composition (`when_all`), and no cancellation. `get()` may be called once: it moves the result out and leaves the future invalid (`valid() == false`), and calling `get()` on an invalid future is UB (implementations usually throw `future_error`); `std::shared_future` allows many. A destroyed `std::promise` that never set a value makes `get()` throw `std::future_error` with `broken_promise`. These limits are why libraries built their own futures, and why the committee standardized senders.

A future with continuations keeps, in its shared state, the result and a slot for the continuation, protected by a mutex or an atomic state machine. Whichever side arrives second runs the continuation: `then(f)` on an already completed future runs `f` at once; setting the value on a future that already has a continuation runs it then. `when_all` counts down completions and fulfills its own promise when the last input completes.

*Further reading:* [`std::future` (cppreference)](https://en.cppreference.com/w/cpp/thread/future), [`std::promise` (cppreference)](https://en.cppreference.com/w/cpp/thread/promise), [`std::packaged_task` (cppreference)](https://en.cppreference.com/w/cpp/thread/packaged_task)

### `std::execution` (C++26, P2300)

Senders describe work lazily; nothing runs until a sender is connected to a receiver and started.

- A **scheduler** represents an execution context (a thread pool, an event loop); `schedule(sch)` returns a sender that completes on it.
- A **sender** completes through one of three channels: `set_value(args...)`, `set_error(e)` or `set_stopped()`.
- Algorithms compose senders: `just(v)`, `then(f)`, `let_value(f)` (f returns a sender), `when_all(s1, s2)`, `starts_on(sch, s)`, `continues_on(s, sch)`, `sync_wait(s)` to block for a result.
- It's *structured concurrency*: child work can't outlive the scope that started it, and cancellation propagates through stop tokens.

NVIDIA's `stdexec` is the reference implementation, usable today with C++20; it also provides a thread-pool scheduler (`exec::static_thread_pool`). Cancellation: pass a `std::stop_source`'s token in through the receiver's environment (or use a `stop_token`-aware algorithm); when stop is requested, well-behaved senders complete with `set_stopped()` instead of a value.

*Further reading:* [Execution library (cppreference)](https://en.cppreference.com/w/cpp/execution)

### Coroutines on executors

A coroutine `Task<T>` becomes asynchronous when awaiting a scheduler: `co_await pool.schedule();` suspends and resumes on a pool thread. Use symmetric transfer (returning the next `coroutine_handle` from `await_suspend`) when one coroutine completes and resumes its awaiter, to avoid unbounded stack growth. Propagate cancellation through `std::stop_token`. Watch lifetimes: everything a coroutine references must outlive every suspension point. Reference and view parameters (`const std::string&`, `std::string_view`, `std::span`) are stored in the frame as references only, and a temporary argument dies at the end of the caller's statement, before the coroutine resumes, so take such parameters by value (:sec[cpp20-to-cpp26/coroutines]).

### What the hot path does instead

Critical threads are pinned to isolated cores and run a tight loop: poll the NIC or a queue, process, repeat. There's no thread switch, no scheduler, and no wakeup latency. Hand-offs to other threads use SPSC queues. Async frameworks are used around that core, not inside it.
