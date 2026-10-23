:::bug{#B1 findings=ub}
```cpp run=none
void on_sigterm(int) {
    printf("shutting down\n");
    flush_positions();     // allocates and locks
    exit(0);
}
```
::answer
Undefined behavior: `printf`, allocation, locks and `exit` aren't async-signal-safe, and calling them from a signal handler is UB. In practice, if the signal lands while the main thread holds the malloc lock, it deadlocks. Set an atomic flag in the handler and shut down from the main loop (or use `signalfd`).
:::

:::bug{#B2 findings=ub}
```cpp run=none
struct SharedBook { Level* best_bid; Level levels[1024]; };
// placed in shared memory and read by another process
```
::answer
Undefined behavior in the reader: a raw pointer is meaningless in another process that maps the segment at a different address, so dereferencing `best_bid` there reads whatever happens to be at that address. Store an index or offset.
:::

:::bug{#B3 findings=defined-bug}
```cpp run=none
ssize_t n = send(fd, buf, len, 0);   // peer may have disconnected
```
::answer
Defined behavior, but fatal: if the peer closed, `send` raises `SIGPIPE`, whose default action kills the process. Use `MSG_NOSIGNAL` (Linux), `SO_NOSIGPIPE` (macOS), or ignore `SIGPIPE`, then handle `EPIPE`.
:::

:::bug{#B4 findings=defined-bug}
The strategy thread allocates a 2 GB order history buffer at startup and writes to it for the first time when the market opens.
::answer
Defined behavior, but slow: first touch at market open triggers hundreds of thousands of page faults exactly when latency matters. Prefault (write every page) and `mlock` at startup, ideally with huge pages.
:::

:::bug{#B5 findings=defined-bug}
```cpp run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
std::thread logger(run_logger);
if (fork() == 0) { log("child started"); exec_worker(); }
```
::answer
Defined behavior, but it can deadlock: the child has only the forking thread; if the logger thread held a lock used by `log()`, the child deadlocks. Fork before starting threads, or call only async-signal-safe functions before `exec`.
:::
