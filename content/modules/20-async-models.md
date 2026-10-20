# Module 20: Async models

Outside the hot path, trading systems still run plenty of concurrent work: risk aggregation, reference data loading, logging, analytics. This module covers thread pools, work stealing, futures, C++26 senders/receivers and coroutine executors. On the hot path itself, the usual answer is different: one pinned thread per core, busy-polling, no scheduler at all.

## Notes

### 20.1 Thread pools

- **Single shared queue:** simple, fair, but every submit and take contends on one lock or atomic.
- **Per-worker queues with work stealing:** each worker pushes and pops its own deque at the bottom (LIFO, cache-hot); idle workers steal from the top of others' deques (FIFO, oldest and usually largest tasks). The Chase-Lev deque makes the owner's operations nearly free. Go's runtime uses the same idea: per-processor run queues with stealing.
- **Sizing:** CPU-bound work wants about one thread per core. Blocking I/O inside a pool starves it; give blocking work its own pool, or use asynchronous I/O.
- **Deadlock risk:** a task that blocks waiting for another task in the same pool can deadlock once all workers are blocked the same way.
- **Shutdown:** stop accepting work, signal workers (`stop_token`), wake sleepers, join.

### 20.2 Futures and their limits

`std::future` supports only blocking `get()` and `wait()`; there's no `.then()` continuation, no composition (`when_all`), and no cancellation. `get()` may be called once (calling it on an invalid future is UB); `std::shared_future` allows many. A destroyed `std::promise` that never set a value makes `get()` throw `std::future_error` with `broken_promise`. These limits are why libraries built their own futures, and why the committee standardized senders.

### 20.3 `std::execution` (C++26, P2300)

Senders describe work lazily; nothing runs until a sender is connected to a receiver and started.

- A **scheduler** represents an execution context (a thread pool, an event loop); `schedule(sch)` returns a sender that completes on it.
- A **sender** completes through one of three channels: `set_value(args...)`, `set_error(e)` or `set_stopped()`.
- Algorithms compose senders: `just(v)`, `then(f)`, `let_value(f)` (f returns a sender), `when_all(s1, s2)`, `starts_on(sch, s)`, `continues_on(s, sch)`, `sync_wait(s)` to block for a result.
- It's *structured concurrency*: child work can't outlive the scope that started it, and cancellation propagates through stop tokens.

NVIDIA's `stdexec` is the reference implementation, usable today with C++20.

### 20.4 Coroutines on executors

A coroutine `Task<T>` becomes asynchronous when awaiting a scheduler: `co_await pool.schedule();` suspends and resumes on a pool thread. Use symmetric transfer (returning the next `coroutine_handle` from `await_suspend`) when one coroutine completes and resumes its awaiter, to avoid unbounded stack growth. Propagate cancellation through `std::stop_token`. Watch lifetimes: everything a coroutine references must outlive every suspension point.

### 20.5 What the hot path does instead

Critical threads are pinned to isolated cores and run a tight loop: poll the NIC or a queue, process, repeat. There's no thread switch, no scheduler, and no wakeup latency. Hand-offs to other threads use SPSC queues. Async frameworks are used around that core, not inside it.

## Predict the output

**P1**

```cpp kind=fragment run=none
std::packaged_task<int(int)> t([](int x) { return x * 2; });
auto f = t.get_future();
t(21);
cout << f.get();
```

**P2**

```cpp kind=fragment run=none
std::promise<int> p;
auto f = p.get_future();
p.set_exception(std::make_exception_ptr(std::runtime_error("rejected")));
try { f.get(); } catch (const std::exception& e) { cout << e.what(); }
```

**P3**

```cpp kind=fragment run=none
std::future<int> f;
{
    std::promise<int> p;
    f = p.get_future();
}
try { f.get(); }
catch (const std::future_error& e) { cout << (e.code() == std::future_errc::broken_promise); }
```

**P4** (with `stdexec`, the reference implementation of `std::execution`)

```cpp kind=fragment run=none
auto s = stdexec::just(3)
       | stdexec::then([](int x) { cout << 'A'; return x + 1; });
cout << 'B';
auto [r] = stdexec::sync_wait(std::move(s)).value();
cout << r;
```

**P5** A pool has 4 workers. You submit 4 tasks, and each task submits a subtask to the same pool and blocks on its future. What happens?

## Spot the bug or UB

**U1**

```cpp kind=fragment run=none
auto f = pool.submit(compute);
int a = f.get();
int b = f.get();
```

**U2**

```cpp kind=fragment run=none
void schedule_reports(ThreadPool& pool) {
    std::vector<Report> reports = build();
    for (auto& r : reports) pool.submit([&r] { send(r); });
}
```

**U3**

```cpp kind=fragment run=none
ThreadPool::~ThreadPool() {
    for (auto& t : workers_) t.join();   // workers block forever in cv.wait
}
```

**U4**

```cpp kind=fragment run=none
Task<void> refresh(Cache& cache, std::string_view key) {
    auto data = co_await fetch(std::string(key));
    cache.put(key, data);
}
// called as: refresh(cache, make_key(sym));
```

## Exercises

**E1 ★ Basic pool.** Implement a fixed pool with one mutex-protected queue and `submit(f)` returning `std::future<R>` (via `std::packaged_task`). Support clean shutdown with `std::jthread` and `stop_token`.

**E2 ★★ Work stealing.** Give each worker its own mutex-protected deque; owners use the back, thieves the front. Compare against E1 on a recursive fork-join workload (parallel sum over a large array, splitting until 10K elements).

**E3 ★★ Continuations.** Implement `Future<T>` and `Promise<T>` with `then(f)` that runs `f` on completion (inline if already complete) and returns `Future<R>`, plus `when_all` for two futures.

**E4 ★★ Senders.** Using `stdexec` (via CMake `FetchContent`), build a pipeline on a static thread pool: load three instrument files in parallel with `when_all`, parse each, merge, and `sync_wait` the result. Add cancellation with a stop source.

**E5 ★★★ Coroutine executor.** Implement `Task<T>` with symmetric transfer and a `schedule()` awaitable for your E1 pool. Run 1M chained tasks without stack overflow and measure per-task overhead.

**E6 ★★★ Chase-Lev deque.** Implement the lock-free work-stealing deque with a growable circular array and correct memory orders (Le et al., "Correct and Efficient Work-Stealing for Weak Memory Models"). Swap it into E2.

## Interview questions

1. How would you design a thread pool? What are the trade-offs between one queue and per-worker queues?
2. How does work stealing work, and why do owners use LIFO and thieves FIFO?
3. What are the limitations of `std::future`?
4. Explain senders and receivers. What does "lazy" mean here?
5. What is structured concurrency?
6. How many threads should a pool have?
7. How do you handle blocking I/O in a pool?
8. Compare Go's goroutine scheduler with a C++ thread pool.
9. Why do trading hot paths avoid thread pools entirely?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `42` | Invoking the task fulfills its future. |
| P2 | `rejected` | `get()` rethrows the stored exception. |
| P3 | `1` | Destroying an unsatisfied promise stores a `broken_promise` error. |
| P4 | `BA4` | Senders are lazy; `then`'s function runs only inside `sync_wait`. |
| P5 | Deadlock | All 4 workers block waiting for subtasks that no free worker can run. |

### Spot the bug or UB

- **U1:** The second `get()` on an invalid future is UB (implementations typically throw `future_error`). Store the result, or use `std::shared_future`.
- **U2:** The lambdas capture references to elements of a local vector destroyed when the function returns, while tasks may still be queued: dangling. Move each `Report` into its lambda.
- **U3:** Workers wait on the condition variable with no stop signal, so `join` hangs. Set a stop flag under the lock, `notify_all`, then join (or use `jthread` with `stop_token` and `condition_variable_any`).
- **U4:** `key` views a temporary string that dies when the caller's statement ends, but it's used after the `co_await`. Take `std::string` by value.

### Exercise hints

- **E2:** With one shared queue, every split contends on one lock; with per-worker deques, most pushes and pops are uncontended and stealing is rare.
- **E3:** Store the continuation in shared state guarded by a mutex or an atomic state machine; whoever arrives second (value or continuation) runs it.
- **E5:** Without symmetric transfer, each completed task resumes its awaiter from inside the previous frame's call stack, so a million-long chain overflows the stack.

### Interview questions

1. Workers, a task queue, submission returning a handle, and shutdown. One queue is simple and fair but contended; per-worker queues scale better and keep caches warm but need stealing for balance.
2. Idle workers take tasks from others' deques. Owners take newest tasks (still in cache, small); thieves take the oldest (likely the biggest chunk of remaining work, reducing future steals) from the other end, minimizing conflicts.
3. Blocking-only, single `get()`, no continuations, no composition, no cancellation, and `std::async`'s blocking destructor.
4. Senders describe asynchronous work and its completion signatures; receivers consume results through value, error and stopped channels. Lazy: composing senders builds a description; nothing runs until it's connected and started.
5. Concurrent work is scoped: a parent can't finish until its children finish or are cancelled, so lifetimes nest like function calls and no work leaks.
6. About one per core for CPU-bound work, minus cores reserved for latency-critical threads; more only if tasks block.
7. Separate pools for blocking work, asynchronous I/O with completion callbacks or coroutines, or an event loop (Module 25).
8. Go multiplexes goroutines onto OS threads with per-processor run queues and stealing, preempts goroutines, and parks them on blocking calls. A C++ pool runs tasks to completion, can't preempt, and blocking ties up a worker unless you use coroutines or async I/O.
9. Scheduling adds queueing delay, wakeup latency and cache disruption, and introduces jitter. Pinned busy-polling threads give the lowest and most predictable latency.
