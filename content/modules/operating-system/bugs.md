:::bug{#B1}
```cpp run=none
void on_sigterm(int) {
    printf("shutting down\n");
    flush_positions();     // allocates and locks
    exit(0);
}
```
::answer
`printf`, allocation, locks and `exit` aren't async-signal-safe; if the signal lands while the main thread holds the malloc lock, it deadlocks. Set an atomic flag in the handler and shut down from the main loop (or use `signalfd`).
:::

:::bug{#B2}
```cpp run=none
struct SharedBook { Level* best_bid; Level levels[1024]; };
// placed in shared memory and read by another process
```
::answer
A raw pointer is meaningless in another process that maps the segment at a different address. Store an index or offset.
:::

:::bug{#B3}
```cpp run=none
ssize_t n = send(fd, buf, len, 0);   // peer may have disconnected
```
::answer
If the peer closed, `send` raises `SIGPIPE` and kills the process. Use `MSG_NOSIGNAL` (Linux), `SO_NOSIGPIPE` (macOS), or ignore `SIGPIPE`, then handle `EPIPE`.
:::

:::bug{#B4}
The strategy thread allocates a 2 GB order history buffer at startup and writes to it for the first time when the market opens.
::answer
First touch at market open triggers hundreds of thousands of page faults exactly when latency matters. Prefault (write every page) and `mlock` at startup, ideally with huge pages.
:::

:::bug{#B5}
```cpp run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
std::thread logger(run_logger);
if (fork() == 0) { log("child started"); exec_worker(); }
```
::answer
The child has only the forking thread; if the logger thread held a lock used by `log()`, the child deadlocks. Fork before starting threads, or call only async-signal-safe functions before `exec`.
:::
