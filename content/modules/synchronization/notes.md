### Threads

- `std::thread t(f, args...)` copies (or moves) the arguments into storage owned by the new thread, then calls `f` with those copies as rvalues. A parameter of type `T&` can't bind to an rvalue, so passing a variable to it doesn't compile; wrap it in `std::ref(x)` (or `std::cref`) to pass a reference, and then you must make sure `x` outlives the thread.
- A `std::thread` that is still joinable when destroyed calls `std::terminate`: you must `join()` or `detach()` on every path, including when an exception unwinds past it.
- `std::jthread` (C++20) carries a `std::stop_source`: its destructor calls `request_stop()` and then `join()`. If the thread function takes a `std::stop_token` as its first parameter, `jthread` passes one in, and the function polls `stop_requested()` (or registers a `std::stop_callback`) for cooperative cancellation. Nothing forces the thread to stop; it has to check.
- `thread_local` variables have one instance per thread, initialized on first use (or thread start) and destroyed at thread exit. Each thread, including `main`'s, sees only its own instance.
- Threads are expensive: creation costs tens of microseconds and each has a stack of around 512 KB to 8 MB. Use pools (:mod[async-models]) or long-lived dedicated threads.
- Two threads accessing the same non-atomic object, at least one of them writing, without synchronization is a *data race*, and a data race is undefined behavior, not just a lost update (:mod[memory-model]). Make the variable atomic, protect it with a mutex, or give each thread its own copy and combine at the end. ThreadSanitizer (`-fsanitize=thread`) finds races at run time.

> **Coming from Go?** Go gives you goroutines, channels and a built-in race detector. C++ gives you OS threads, mutexes, condition variables and atomics; TSan plays the role of `go test -race`, and a channel is something you build (exercise E2).

*Further reading:* [`std::thread` (cppreference)](https://en.cppreference.com/w/cpp/thread/thread), [`std::jthread` (cppreference)](https://en.cppreference.com/w/cpp/thread/jthread)

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

A lock protects data only while it's held. Returning a reference, pointer or iterator to guarded data from a function that locks internally hands the caller access after the guard's destructor has unlocked: every later access is unprotected. Return a copy, or take a callable and run it under the lock.

How a mutex works: the uncontended path is a single atomic compare-and-swap in user space (\~10–25 ns). If the CAS fails, the thread marks the lock as contended and sleeps in the kernel (a futex on Linux, `os_unfair_lock`-style primitives on macOS, `WaitOnAddress`/SRW locks on Windows); unlock is an atomic store that makes a system call to wake a waiter only if the contended mark is set. Each sleep/wake costs microseconds.

`std::shared_mutex` keeps a reader count that every `lock_shared` and `unlock_shared` modifies atomically, so readers still bounce one cache line between cores, and its bookkeeping is heavier than a plain mutex's. Whether waiting writers block new readers is unspecified, so a steady stream of readers can starve a writer on some implementations. It pays off only when read sections are long and writes are rare.

Contention has a cost even without a mutex. A core must own a cache line exclusively to write it, so threads doing read-modify-writes on one shared atomic take turns moving that line between cores, and adding threads makes the total slower, not faster. Per-thread counters on separate cache lines, summed at the end, scale with the number of threads (:mod[lock-free-programming]).

*Further reading:* [`std::mutex` (cppreference)](https://en.cppreference.com/w/cpp/thread/mutex), [`std::scoped_lock` (cppreference)](https://en.cppreference.com/w/cpp/thread/scoped_lock), [`std::shared_mutex` (cppreference)](https://en.cppreference.com/w/cpp/thread/shared_mutex)

### Deadlock

Deadlock needs four conditions: mutual exclusion, hold-and-wait, no preemption, circular wait. Break the cycle: always acquire locks in one global order (a lock hierarchy), lock multiple mutexes with `std::scoped_lock`, never call unknown code (callbacks) while holding a lock, and keep critical sections short.

`std::scoped_lock lk(m1, m2)` (and the older `std::lock(m1, m2)`) acquires all its mutexes without deadlock whatever order different threads list them in: it locks one, tries the others with `try_lock`, and if any fails, releases what it holds and retries, typically starting with the one that failed. Two nested `lock_guard`s take their mutexes one at a time in the written order, so two threads writing them in opposite orders can each hold one and wait forever for the other. `scoped_lock` given the same mutex twice is still UB, so code that might lock an object against itself (a transfer from an account to itself) must check for that first.

*Priority inversion* is a related stall: a low-priority thread holds a lock that a high-priority thread needs, and medium-priority threads keep the low one from running, so the high-priority thread waits on the medium ones. Fixes are priority inheritance (the holder temporarily runs at the waiter's priority; POSIX `PTHREAD_PRIO_INHERIT` mutexes) or not sharing locks across priority levels.

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

- `cv.wait(lk)` atomically unlocks `m` and sleeps; it relocks `m` before returning. A notify that arrives while no thread is waiting is not remembered.
- Always wait with a predicate: waits can wake spuriously, and the predicate also handles the case where the notification happened before the wait began. `wait(lk, pred)` is `while (!pred()) wait(lk);`.
- The shared state must be modified under the mutex, even if it's atomic. Otherwise a *lost wakeup* is possible: the consumer checks the predicate, the producer changes state and notifies, and then the consumer goes to sleep, never woken.
- Notifying after releasing the lock avoids waking a thread that immediately blocks on the mutex.
- `notify_one` wakes one waiter; use `notify_all` when a change can matter to every waiter, such as closing a queue or shutting down, and when waiters on one condition variable wait for different conditions.
- `std::condition_variable_any` works with any lockable and supports waiting with a `stop_token`.

*Further reading:* [`std::condition_variable` (cppreference)](https://en.cppreference.com/w/cpp/thread/condition_variable)

### Other primitives (C++20)

- `std::latch`: single-use countdown; threads wait until it reaches zero.
- `std::barrier`: reusable; all participants wait for each other each phase, with an optional completion function.
- `std::counting_semaphore` and `std::binary_semaphore`: permits; lighter than mutex + condition variable for signaling.
- `std::atomic<T>::wait` and `notify_one`/`notify_all`: block until an atomic's value changes, like a futex.
- One-time initialization: a function-local `static` is initialized exactly once even when several threads reach it at once; the others block until it's done (\[stmt.dcl\]). `std::call_once` with a `std::once_flag` does the same for arbitrary code. Hand-rolled double-checked locking on a plain pointer is a data race: the unlocked first check reads the pointer while another thread writes it, and nothing orders the object's construction before the pointer becomes visible (:mod[memory-model] shows the atomic version).

*Further reading:* [`std::latch` (cppreference)](https://en.cppreference.com/w/cpp/thread/latch), [`std::barrier` (cppreference)](https://en.cppreference.com/w/cpp/thread/barrier), [`std::counting_semaphore` (cppreference)](https://en.cppreference.com/w/cpp/thread/counting_semaphore), [`std::call_once` (cppreference)](https://en.cppreference.com/w/cpp/thread/call_once)

### Futures and `std::async`

`std::promise` sets a value or exception that a `std::future` retrieves; `std::packaged_task` wraps a callable to fulfill a promise. `std::async(std::launch::async, f)` runs `f` on a new thread, and the destructor of the returned future *blocks* until it finishes, so discarding the result doesn't give fire-and-forget: a discarded future is destroyed at the end of its statement, so two such calls run one after the other. Only futures that come from `std::async` block in their destructor; one from a `promise` or `packaged_task` doesn't. Without `launch::async`, the implementation may defer execution until `get()`.

*Further reading:* [`std::async` (cppreference)](https://en.cppreference.com/w/cpp/thread/async), [`std::future` (cppreference)](https://en.cppreference.com/w/cpp/thread/future)

### Spinlocks

Spinning instead of sleeping saves the kernel round trip when critical sections are tiny and threads are pinned to dedicated cores, which describes many trading hot paths. Implement as test-and-test-and-set: spin on a relaxed load until the lock looks free, then try an `exchange` with acquire; use a pause instruction while spinning (`_mm_pause` on x86, `yield` or `isb` on ARM). Under contention, add backoff: after each failed attempt, spin for longer (doubling up to a cap) before retrying, so waiters stop hammering the line. Never spin when threads can be preempted onto the same core: the holder can't run while you burn its time slice.
