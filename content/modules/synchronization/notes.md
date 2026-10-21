### Threads

- `std::thread t(f, args...)` copies (or moves) the arguments into the new thread; pass references with `std::ref`. A `std::thread` that is still joinable when destroyed calls `std::terminate`: you must `join()` or `detach()`.
- `std::jthread` (C++20) joins in its destructor and carries a `std::stop_token` for cooperative cancellation: the thread function can take a `stop_token` and poll `stop_requested()`.
- `thread_local` variables have one instance per thread, initialized on first use (or thread start) and destroyed at thread exit.
- Threads are expensive: creation costs tens of microseconds and each has a stack of around 512 KB to 8 MB. Use pools (:mod[async-models]) or long-lived dedicated threads.

### Mutexes and locks

| Type | Use |
| --- | --- |
| `std::mutex` | Default exclusive lock |
| `std::recursive_mutex` | Same thread may relock; usually a design smell |
| `std::timed_mutex` | `try_lock_for` with timeout |
| `std::shared_mutex` | Many readers or one writer; often slower than a plain mutex for short sections |
| `std::lock_guard` | Scoped lock of one mutex |
| `std::unique_lock` | Movable, can unlock early, defer, try; required by `condition_variable` |
| `std::scoped_lock` | Locks several mutexes at once with a deadlock-avoidance algorithm |
| `std::shared_lock` | Shared (reader) lock of a `shared_mutex` |

A mutex locked by one thread must be unlocked by the same thread. Locking a non-recursive mutex twice from one thread is UB (usually a deadlock).

How a mutex works: the uncontended path is a single atomic compare-and-swap in user space (\~10–25 ns). Under contention, waiters sleep in the kernel (a futex on Linux, `os_unfair_lock`-style primitives on macOS), and each sleep/wake costs microseconds.

### Deadlock

Deadlock needs four conditions: mutual exclusion, hold-and-wait, no preemption, circular wait. Break the cycle: always acquire locks in one global order (a lock hierarchy), lock multiple mutexes with `std::scoped_lock`, never call unknown code (callbacks) while holding a lock, and keep critical sections short.

### Condition variables

A condition variable lets a thread sleep until another thread changes shared state. The pattern:

```cpp kind=fragment run=none
// consumer
std::unique_lock lk(m);
cv.wait(lk, [&] { return !queue.empty() || closed; });
// producer
{ std::lock_guard lk(m); queue.push(x); }
cv.notify_one();
```

- Always wait with a predicate: waits can wake spuriously, and the predicate also handles the case where the notification happened before the wait began.
- The shared state must be modified under the mutex, even if it's atomic. Otherwise a *lost wakeup* is possible: the consumer checks the predicate, the producer changes state and notifies, and then the consumer goes to sleep, never woken.
- Notifying after releasing the lock avoids waking a thread that immediately blocks on the mutex.
- `std::condition_variable_any` works with any lockable and supports waiting with a `stop_token`.

### Other primitives (C++20)

- `std::latch`: single-use countdown; threads wait until it reaches zero.
- `std::barrier`: reusable; all participants wait for each other each phase, with an optional completion function.
- `std::counting_semaphore` and `std::binary_semaphore`: permits; lighter than mutex + condition variable for signaling.
- `std::atomic<T>::wait` and `notify_one`/`notify_all`: block until an atomic's value changes, like a futex.
- `std::call_once` with `std::once_flag`, and function-local statics, for one-time initialization.

### Futures and `std::async`

`std::promise` sets a value or exception that a `std::future` retrieves; `std::packaged_task` wraps a callable to fulfill a promise. `std::async(std::launch::async, f)` runs `f` on a new thread, and the destructor of the returned future *blocks* until it finishes, so discarding the result doesn't give fire-and-forget. Without `launch::async`, the implementation may defer execution until `get()`.

### Spinlocks

Spinning instead of sleeping saves the kernel round trip when critical sections are tiny and threads are pinned to dedicated cores, which describes many trading hot paths. Implement as test-and-test-and-set: spin on a relaxed load until the lock looks free, then try an `exchange` with acquire; use a pause instruction while spinning (`_mm_pause` on x86, `yield` or `isb` on ARM). Never spin when threads can be preempted onto the same core: the holder can't run while you burn its time slice.
