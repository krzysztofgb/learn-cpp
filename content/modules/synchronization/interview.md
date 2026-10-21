:::question{#Q1}
Mutex vs spinlock: when would you use each?
::answer
A mutex sleeps under contention, which suits longer or unpredictable sections. A spinlock busy-waits, which suits very short sections on dedicated cores where a kernel round trip would cost more than waiting.
:::

:::question{#Q2}
How is a mutex implemented? What does contention cost?
::answer
An atomic word: lock with a CAS in user space; if it fails, mark contention and sleep in the kernel (futex); unlock with an atomic store and wake a waiter if marked. Uncontended \~20 ns; contended adds context switches costing microseconds plus cache misses.
:::

:::question{#Q3}
Why must condition variable waits use a predicate?
::answer
Spurious wakeups are allowed, and the condition may have been satisfied (or consumed by another thread) independently of the notify.
:::

:::question{#Q4}
What is a lost wakeup and how do you prevent it?
::answer
A notification arriving between checking the condition and going to sleep. Prevent it by changing the shared state while holding the mutex the waiter uses.
:::

:::question{#Q5}
What are the conditions for deadlock, and how do you avoid it?
::answer
Mutual exclusion, hold-and-wait, no preemption, circular wait. Avoid with a global lock order, `scoped_lock`/`std::lock`, try-lock with back-off, and not holding locks while calling out.
:::

:::question{#Q6}
What does `std::scoped_lock` do differently from two `lock_guard`s?
::answer
It acquires all mutexes using a deadlock-avoidance algorithm (lock one, try the others, back off and retry), so lock order doesn't matter.
:::

:::question{#Q7}
`std::thread` vs `std::jthread`?
::answer
`jthread` joins automatically in its destructor and supports cooperative cancellation through `stop_token`.
:::

:::question{#Q8}
What's surprising about `std::async`'s returned future?
::answer
Its destructor blocks until the task completes, so you can't fire and forget, and without an explicit policy it may run lazily on `get()`.
:::

:::question{#Q9}
When is `shared_mutex` a bad choice?
::answer
When critical sections are short or writes are frequent: its bookkeeping is heavier than a mutex's, readers still contend on its internal state, and writers can starve.
:::

:::question{#Q10}
What's wrong with classic double-checked locking, and how do you fix it?
::answer
The unsynchronized read of the pointer races with the write, and the pointer can become visible before the object's construction does. Fix with a function-local static, `std::call_once`, or an atomic pointer: release store after construction, acquire load on the fast path.
:::

:::question{#Q11}
What is priority inversion?
::answer
A low-priority thread holds a lock a high-priority thread needs, while medium-priority threads keep the low one from running. Mitigations: priority inheritance, or not sharing locks across priority levels.
:::
