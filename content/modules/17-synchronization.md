# Module 17: Threads and synchronization

Go gives you goroutines and channels and a race detector. C++ gives you OS threads, mutexes, condition variables and atomics, and data races are UB. This module covers the blocking primitives; Modules 18 and 19 cover atomics and lock-free code.

## Notes

### 17.1 Threads

- `std::thread t(f, args...)` copies (or moves) the arguments into the new thread; pass references with `std::ref`. A `std::thread` that is still joinable when destroyed calls `std::terminate`: you must `join()` or `detach()`.
- `std::jthread` (C++20) joins in its destructor and carries a `std::stop_token` for cooperative cancellation: the thread function can take a `stop_token` and poll `stop_requested()`.
- `thread_local` variables have one instance per thread, initialized on first use (or thread start) and destroyed at thread exit.
- Threads are expensive: creation costs tens of microseconds and each has a stack of around 512 KB to 8 MB. Use pools (Module 20) or long-lived dedicated threads.

### 17.2 Mutexes and locks

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

### 17.3 Deadlock

Deadlock needs four conditions: mutual exclusion, hold-and-wait, no preemption, circular wait. Break the cycle: always acquire locks in one global order (a lock hierarchy), lock multiple mutexes with `std::scoped_lock`, never call unknown code (callbacks) while holding a lock, and keep critical sections short.

### 17.4 Condition variables

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

### 17.5 Other primitives (C++20)

- `std::latch`: single-use countdown; threads wait until it reaches zero.
- `std::barrier`: reusable; all participants wait for each other each phase, with an optional completion function.
- `std::counting_semaphore` and `std::binary_semaphore`: permits; lighter than mutex + condition variable for signaling.
- `std::atomic<T>::wait` and `notify_one`/`notify_all`: block until an atomic's value changes, like a futex.
- `std::call_once` with `std::once_flag`, and function-local statics, for one-time initialization.

### 17.6 Futures and `std::async`

`std::promise` sets a value or exception that a `std::future` retrieves; `std::packaged_task` wraps a callable to fulfill a promise. `std::async(std::launch::async, f)` runs `f` on a new thread, and the destructor of the returned future *blocks* until it finishes, so discarding the result doesn't give fire-and-forget. Without `launch::async`, the implementation may defer execution until `get()`.

### 17.7 Spinlocks

Spinning instead of sleeping saves the kernel round trip when critical sections are tiny and threads are pinned to dedicated cores, which describes many trading hot paths. Implement as test-and-test-and-set: spin on a relaxed load until the lock looks free, then try an `exchange` with acquire; use a pause instruction while spinning (`_mm_pause` on x86, `yield` or `isb` on ARM). Never spin when threads can be preempted onto the same core: the holder can't run while you burn its time slice.

## Predict the output

**P1**

```cpp kind=program run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
void start() { std::thread t([] {}); }
int main() { start(); cout << "ok"; }
```

**P2**

```cpp kind=fragment run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
void inc(int& x) { ++x; }
int n = 0;
std::thread t(inc, std::ref(n));
t.join();
cout << n;
// What if std::ref is removed?
```

**P3**

```cpp kind=fragment run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
using namespace std::chrono;
auto start = steady_clock::now();
std::async(std::launch::async, [] { std::this_thread::sleep_for(1s); });
std::async(std::launch::async, [] { std::this_thread::sleep_for(1s); });
cout << duration_cast<seconds>(steady_clock::now() - start).count();
```

**P4**

```cpp kind=fragment run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
thread_local int counter = 0;
auto work = [] { for (int i = 0; i < 1000; ++i) ++counter; return counter; };
int r1, r2;
std::thread a([&] { r1 = work(); });
std::thread b([&] { r2 = work(); });
a.join(); b.join();
cout << r1 << ' ' << r2 << ' ' << counter;
```

**P5** Thread A runs `std::scoped_lock lk(m1, m2);` while thread B runs `std::scoped_lock lk(m2, m1);`, repeatedly. Can they deadlock? What if each uses two `lock_guard`s in its listed order?

## Spot the bug or UB

**U1**

```cpp kind=fragment run=local
long fills = 0;
// 4 threads each run:
for (int i = 0; i < 1'000'000; ++i) ++fills;
```

**U2**

```cpp kind=fragment run=none
std::unique_lock lk(m);
cv.wait(lk);
process(queue.front());
queue.pop();
```

**U3**

```cpp kind=fragment run=none
std::atomic<bool> ready{false};
// producer:
ready = true;
cv.notify_one();
// consumer:
std::unique_lock lk(m);
cv.wait(lk, [&] { return ready.load(); });
```

**U4**

```cpp kind=fragment run=none
Widget* g_inst = nullptr;
std::mutex g_m;
Widget* get() {
    if (!g_inst) {
        std::lock_guard lk(g_m);
        if (!g_inst) g_inst = new Widget;
    }
    return g_inst;
}
```

**U5**

```cpp kind=fragment run=none
const std::vector<Order>& Book::orders() {
    std::lock_guard lk(m_);
    return orders_;
}
```

**U6**

```cpp kind=fragment run=none
void Account::transfer(Account& to, long amt) {
    std::lock_guard a(m_);
    std::lock_guard b(to.m_);
    balance_ -= amt; to.balance_ += amt;
}
```

## Exercises

**E1 ★ Counter shootout.** Increment a shared counter 10M times total from 1, 2, 4 and 8 threads using a mutex, a relaxed atomic, and per-thread counters summed at the end. Plot time vs threads and explain.

**E2 ★★ Go-style channel.** Implement `Channel<T>` with a bounded buffer, a mutex and two condition variables: `send` blocks when full, `recv` blocks when empty and returns `std::optional<T>` (empty after `close()` once drained). Verify with TSan under heavy load.

**E3 ★★ Spinlock.** Implement a test-and-test-and-set spinlock with a pause instruction and exponential backoff. Benchmark against `std::mutex` for 10 ns and 1 µs critical sections at 2 and 8 threads.

**E4 ★★ Deadlock lab.** Implement U6, reproduce the deadlock with two threads transferring in opposite directions, inspect it with `lldb` (`thread backtrace all`), and fix it with `std::scoped_lock`.

**E5 ★★ Worker group.** Using `std::jthread`, `std::stop_token` and `std::latch`, start N workers that each process a slice of data, wait for all to finish, and support cancellation mid-way.

**E6 ★★★ Reader-writer lock.** Implement a writer-preferring RW lock with a mutex and condition variables, then compare its throughput with `std::shared_mutex` at different read/write ratios.

## Interview questions

1. Mutex vs spinlock: when would you use each?
2. How is a mutex implemented? What does contention cost?
3. Why must condition variable waits use a predicate?
4. What is a lost wakeup and how do you prevent it?
5. What are the conditions for deadlock, and how do you avoid it?
6. What does `std::scoped_lock` do differently from two `lock_guard`s?
7. `std::thread` vs `std::jthread`?
8. What's surprising about `std::async`'s returned future?
9. When is `shared_mutex` a bad choice?
10. What's wrong with classic double-checked locking, and how do you fix it?
11. What is priority inversion?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | Terminates | `t` is destroyed while joinable, so `std::terminate` runs before "ok". |
| P2 | `1`; without `std::ref`: doesn't compile | `std::thread` copies arguments and passes them as rvalues, which can't bind to `int&`. |
| P3 | `2` | Each discarded future's destructor blocks until its task finishes. |
| P4 | `1000 1000 0` | Each thread has its own `counter`; main's is untouched. |
| P5 | No; with `lock_guard`s: yes | `scoped_lock` acquires both without deadlock regardless of order; nested guards in opposite orders form a cycle. |

### Spot the bug or UB

- **U1:** Data race on a non-atomic variable: UB. In practice increments are lost. Use `std::atomic<long>` or per-thread counters.
- **U2:** Waits without a predicate: a spurious wakeup reaches `queue.front()` on an empty queue (UB), and a notification sent before `wait` is missed forever. Use `cv.wait(lk, [&] { return !queue.empty(); });`.
- **U3:** Lost wakeup: the consumer can check `ready` (false), then the producer sets it and notifies before the consumer sleeps. Set `ready` while holding `m`.
- **U4:** Data race on `g_inst` (UB), and another thread can see the pointer before the `Widget` is fully constructed. Use a function-local static, or an atomic pointer with acquire/release.
- **U5:** The lock is released on return, so callers read `orders_` unprotected while writers modify it. Return a copy, or take a callback that runs under the lock.
- **U6:** Two transfers in opposite directions can each hold one lock and wait for the other: deadlock. Use `std::scoped_lock lk(m_, to.m_);`, and handle self-transfer (locking the same mutex twice is UB).

### Exercise hints

- **E1:** The atomic version gets slower as threads are added because the cache line bounces; per-thread counters scale nearly linearly. Mutex is worst due to sleeps.
- **E2:** `close()` sets a flag under the lock and calls `notify_all` on both condition variables; `recv` waits for `!empty || closed`.
- **E3:** Spinlocks win for tiny sections when threads aren't oversubscribed; they lose badly for long sections and when threads exceed cores.

### Interview questions

1. A mutex sleeps under contention, which suits longer or unpredictable sections. A spinlock busy-waits, which suits very short sections on dedicated cores where a kernel round trip would cost more than waiting.
2. An atomic word: lock with a CAS in user space; if it fails, mark contention and sleep in the kernel (futex); unlock with an atomic store and wake a waiter if marked. Uncontended \~20 ns; contended adds context switches costing microseconds plus cache misses.
3. Spurious wakeups are allowed, and the condition may have been satisfied (or consumed by another thread) independently of the notify.
4. A notification arriving between checking the condition and going to sleep. Prevent it by changing the shared state while holding the mutex the waiter uses.
5. Mutual exclusion, hold-and-wait, no preemption, circular wait. Avoid with a global lock order, `scoped_lock`/`std::lock`, try-lock with back-off, and not holding locks while calling out.
6. It acquires all mutexes using a deadlock-avoidance algorithm (lock one, try the others, back off and retry), so lock order doesn't matter.
7. `jthread` joins automatically in its destructor and supports cooperative cancellation through `stop_token`.
8. Its destructor blocks until the task completes, so you can't fire and forget, and without an explicit policy it may run lazily on `get()`.
9. When critical sections are short or writes are frequent: its bookkeeping is heavier than a mutex's, readers still contend on its internal state, and writers can starve.
10. The unsynchronized read of the pointer races with the write, and the pointer can become visible before the object's construction does. Fix with a function-local static, `std::call_once`, or an atomic pointer: release store after construction, acquire load on the fast path.
11. A low-priority thread holds a lock a high-priority thread needs, while medium-priority threads keep the low one from running. Mitigations: priority inheritance, or not sharing locks across priority levels.
