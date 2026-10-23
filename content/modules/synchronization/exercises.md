:::exercise{#E1 level=warm-up title="Counter shootout"}
Increment a shared counter 10M times total from 1, 2, 4 and 8 threads using a mutex, a relaxed atomic, and per-thread counters summed at the end. Plot time vs threads and explain.
::hint
The atomic version gets slower as threads are added because the cache line bounces; per-thread counters scale nearly linearly. Mutex is worst due to sleeps.
:::

:::exercise{#E2 level=standard title="Bounded channel"}
Implement `Channel<T>`, a bounded channel: a fixed-capacity queue shared between threads that blocks producers when full and consumers when empty, and can be closed. Use a buffer, a mutex and two condition variables: `send` blocks when full, `recv` blocks when empty and returns `std::optional<T>` (empty after `close()` once drained). Verify with TSan under heavy load.

> **Coming from Go?** This is a buffered Go channel (`make(chan T, n)`), with `recv` returning an empty optional where Go's `v, ok := <-ch` gives `ok == false`.
::hint
`close()` sets a flag under the lock and calls `notify_all` on both condition variables; `recv` waits for `!empty || closed`.
:::

:::exercise{#E3 level=standard title="Spinlock"}
Implement a test-and-test-and-set spinlock with a pause instruction and exponential backoff. Benchmark against `std::mutex` for 10 ns and 1 µs critical sections at 2 and 8 threads.
::hint
Spinlocks win for tiny sections when threads aren't oversubscribed; they lose badly for long sections and when threads exceed cores.
:::

:::exercise{#E4 level=standard title="Deadlock lab"}
Implement U6, reproduce the deadlock with two threads transferring in opposite directions, inspect every thread's stack in a debugger (`thread backtrace all` in LLDB, `thread apply all bt` in GDB, the Parallel Stacks window in Visual Studio), and fix it with `std::scoped_lock`.
:::

:::exercise{#E5 level=standard title="Worker group"}
Using `std::jthread`, `std::stop_token` and `std::latch`, start N workers that each process a slice of data, wait for all to finish, and support cancellation mid-way.
:::

:::exercise{#E6 level=interview-hard title="Reader-writer lock"}
Implement a writer-preferring RW lock with a mutex and condition variables, then compare its throughput with `std::shared_mutex` at different read/write ratios.
:::
