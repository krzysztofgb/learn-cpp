### Processes and threads

A process has its own address space, file descriptors and credentials; threads share all of that but have their own stack, registers and thread-local storage. Linux implements both as tasks (`clone` with different sharing flags).

`fork()` duplicates the address space lazily with copy-on-write: pages are shared read-only until either side writes, and the first write gives the writer its own private copy of that page. Ordinary variables are therefore independent after `fork`: a write in the child never shows up in the parent. In a multithreaded program, only the calling thread exists in the child, so mutexes held by other threads (including locks inside `malloc`, stdio or your logger) stay locked forever; the child should only call async-signal-safe functions until it `exec`s. Fork before starting threads where you can. Windows has no `fork`; `CreateProcess` starts a new program.

**User-space buffers are part of the copied memory.** C stdio (`printf`) and iostreams buffer output inside the process: `stdout` is line-buffered when it's a terminal (flushed at each `'\n'`) and fully buffered when redirected to a file or pipe (flushed when the buffer fills, on `fflush`, or at normal exit); `stderr` is unbuffered. Anything still in the buffer at `fork` exists in both processes and is written by both. Call `fflush(nullptr)` before `fork`, and use `_exit` in a child that doesn't `exec`, so it doesn't flush the inherited buffers again.

*Further reading:* [std::setvbuf](https://en.cppreference.com/w/cpp/io/c/setvbuf)

### Virtual memory

Each process sees a virtual address space mapped to physical pages by multi-level page tables (4 levels on x86-64), cached by the TLB (:mod[hardware]).

- **Demand paging:** `malloc` or `mmap` of a large region only reserves addresses; physical pages are assigned on first touch, one fault per page. Resident memory grows only as pages are touched. (Large `malloc` requests, above 128 KB by default in glibc, are served directly by `mmap`.)
- **Minor fault:** the page is in memory (or just needs zeroing) but not mapped yet, costing roughly 0.5–2 µs including zeroing. **Major fault:** the page must be read from disk, costing milliseconds. Count them with `getrusage` (`ru_minflt`, `ru_majflt`), `/usr/bin/time -v` or `perf stat -e page-faults` on Linux.
- **Overcommit:** Linux may promise more memory than exists and invoke the OOM killer later.
- **`mmap`:** maps files or anonymous memory; the dynamic loader also uses it to map shared libraries. With `MAP_SHARED`, every process mapping the region (including a child after `fork`) sees the same physical pages, so writes are visible to all, and file-backed changes reach the file. `MAP_PRIVATE` is copy-on-write, so each process's writes stay its own. `MAP_POPULATE` prefaults, `MAP_HUGETLB` uses huge pages. `mlock`/`mlockall` pin pages so they're never swapped out.
- **Transparent huge pages** can help TLB reach, but background compaction (`khugepaged`) can cause latency spikes; many firms use explicit huge pages and disable THP defragmentation.
- macOS on Apple Silicon uses 16 KB pages and has no `MAP_POPULATE`. Windows separates reserving address space from committing memory (`VirtualAlloc` with `MEM_RESERVE` and `MEM_COMMIT`), uses 4 KB pages and 2 MB large pages, and pins pages with `VirtualLock`.

### Allocators

`malloc` implementations (glibc ptmalloc, jemalloc, tcmalloc, mimalloc) keep size-class free lists and per-thread caches, obtain memory from the kernel with `brk` or `mmap`, and occasionally return it. Usually fast (tens of ns), but sometimes a call takes a syscall, a page fault or a lock, which is why hot paths avoid it (:mod[low-latency-techniques]).

*Further reading:* [Dynamic memory allocation with new and delete](https://www.learncpp.com/cpp-tutorial/dynamic-memory-allocation-with-new-and-delete/)

### System calls and context switches

- A syscall switches to kernel mode and back: roughly 100 ns to a few hundred ns for trivial calls (such as `getpid` made through `syscall(SYS_getpid)`, which glibc doesn't cache), more with security mitigations. The vDSO maps some calls (like `clock_gettime` and `gettimeofday`) into user space, so on x86-64 and ARM64 Linux they normally read the clock without entering the kernel.
- A context switch saves and restores registers and may switch page tables: a few microseconds including cache and TLB disruption. A thread that blocks (on a condition variable, a futex, `read`) and is woken by another thread pays for two switches and the scheduler's wake-up path; a thread spinning on an atomic in user space sees the change as soon as the cache line arrives, in tens to hundreds of nanoseconds.
- Linux schedulers (CFS, now EEVDF) time-slice normal threads; `SCHED_FIFO` real-time threads run until they block. Isolated cores (`isolcpus`, `nohz_full`) keep the scheduler tick and other tasks off critical cores.
- **Interrupts** from NICs and timers preempt whatever runs on a core; steer them away from critical cores with IRQ affinity.

### Signals

Signals interrupt a thread asynchronously, at any instruction, possibly while it holds the `malloc` lock or is halfway through updating a stdio buffer. A handler may therefore only call async-signal-safe functions (`write`, `_exit`, setting a `volatile std::sig_atomic_t` or lock-free atomic flag) [support.signal]: no `printf`, `malloc`, mutexes or `exit` (which runs `atexit` handlers and flushes stdio). Do the real work outside the handler: set a flag the main loop checks, write a byte to a pipe the event loop watches (the self-pipe trick), or on Linux block the signal and read it as an ordinary event from a `signalfd`.

Writing to a socket whose peer closed raises `SIGPIPE`, which kills the process by default. Ignore it (`signal(SIGPIPE, SIG_IGN)`), pass `MSG_NOSIGNAL` to `send` (Linux), or set `SO_NOSIGPIPE` on the socket (macOS); the call then fails with `EPIPE` instead, which you handle like any other error. Windows has no `SIGPIPE`.

*Further reading:* [std::signal](https://en.cppreference.com/w/cpp/utility/program/signal), [std::sig_atomic_t](https://en.cppreference.com/w/cpp/utility/program/sig_atomic_t)

### Inter-process communication

Pipes and Unix domain sockets go through the kernel (microseconds). Shared memory (`shm_open` + `mmap`, or a mapped file in `/dev/shm`; `CreateFileMapping` + `MapViewOfFile` on Windows) with a lock-free ring buffer is the fastest IPC: no syscalls per message, latency comparable to inter-thread queues. Store offsets, not pointers, in shared memory, because each process may map it at a different address. Market data distribution between processes on one host often works this way.
