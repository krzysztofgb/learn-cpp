:::exercise{#E1 level=warm-up title="Syscall cost"}
On Linux, time `syscall(SYS_getpid)` in a loop vs `clock_gettime` (vDSO). On macOS, compare `getppid()` with `mach_absolute_time()`.
:::

:::exercise{#E2 level=standard title="Page faults"}
Allocate 1 GB, time the first and second write passes, and read fault counts with `getrusage` (`ru_minflt`). On Linux, repeat with `MAP_POPULATE` and with huge pages.
::hint
The second pass is typically many times faster; the difference divided by the page count gives the per-fault cost.
:::

:::exercise{#E3 level=standard title="Shared-memory IPC"}
Put your SPSC ring (:mod[lock-free-programming]) in a `shm_open` region using offsets, and measure round-trip latency between two processes vs a Unix domain socket and a pipe.
:::

:::exercise{#E4 level=standard title="Context switch cost"}
Ping-pong between two threads using a condition variable vs spinning on an atomic, and measure round-trip time. Explain the gap.
::hint
Expect roughly microseconds per round trip with condition variables (two sleeps and wakes) vs tens to hundreds of nanoseconds spinning.
:::

:::exercise{#E5 level=interview-hard title="A small allocator"}
Implement a malloc with size-class free lists over `mmap`'d chunks and per-thread caches, and compare it with the system allocator on a multi-threaded allocation benchmark.
:::
