# Module 24: The operating system

The kernel is the biggest source of latency jitter in a trading system: page faults, scheduling, interrupts and syscalls. Interviews test whether you know what each costs and how firms keep the OS out of the hot path. Linux is the production target; notes mention macOS where it differs.

## Notes

### 24.1 Processes and threads

A process has its own address space, file descriptors and credentials; threads share all of that but have their own stack, registers and thread-local storage. Linux implements both as tasks (`clone` with different sharing flags).

`fork()` duplicates the address space lazily with copy-on-write: pages are shared read-only until either side writes. In a multithreaded program, only the calling thread exists in the child, so mutexes held by other threads stay locked forever; the child should only call async-signal-safe functions until it `exec`s.

### 24.2 Virtual memory

Each process sees a virtual address space mapped to physical pages by multi-level page tables (4 levels on x86-64), cached by the TLB (Module 21).

- **Demand paging:** `malloc` or `mmap` of a large region only reserves addresses; physical pages are assigned on first touch.
- **Minor fault:** the page is in memory (or just needs zeroing) but not mapped yet, costing roughly 0.5–2 µs including zeroing. **Major fault:** the page must be read from disk, costing milliseconds.
- **Overcommit:** Linux may promise more memory than exists and invoke the OOM killer later.
- **`mmap`:** maps files or anonymous memory; `MAP_SHARED` changes are visible to other mappers and backed by the file, `MAP_PRIVATE` is copy-on-write. `MAP_POPULATE` prefaults, `MAP_HUGETLB` uses huge pages. `mlock`/`mlockall` pin pages so they're never swapped out.
- **Transparent huge pages** can help TLB reach, but background compaction (`khugepaged`) can cause latency spikes; many firms use explicit huge pages and disable THP defragmentation.
- macOS on Apple Silicon uses 16 KB pages and has no `MAP_POPULATE`.

### 24.3 Allocators

`malloc` implementations (glibc ptmalloc, jemalloc, tcmalloc, mimalloc) keep size-class free lists and per-thread caches, obtain memory from the kernel with `brk` or `mmap`, and occasionally return it. Usually fast (tens of ns), but sometimes a call takes a syscall, a page fault or a lock, which is why hot paths avoid it (Module 22).

### 24.4 System calls and context switches

- A syscall switches to kernel mode and back: roughly 100 ns to a few hundred ns for trivial calls, more with security mitigations. The vDSO maps some calls (like `clock_gettime`) into user space, so they cost no syscall.
- A context switch saves and restores registers and may switch page tables: a few microseconds including cache and TLB disruption.
- Linux schedulers (CFS, now EEVDF) time-slice normal threads; `SCHED_FIFO` real-time threads run until they block. Isolated cores (`isolcpus`, `nohz_full`) keep the scheduler tick and other tasks off critical cores.
- **Interrupts** from NICs and timers preempt whatever runs on a core; steer them away from critical cores with IRQ affinity.

### 24.5 Signals

Signals interrupt a thread asynchronously. Handlers may only call async-signal-safe functions (`write`, `_exit`, setting a `volatile std::sig_atomic_t` or lock-free atomic): no `printf`, `malloc` or mutexes. Writing to a socket whose peer closed raises `SIGPIPE`, which kills the process by default; ignore it, or pass `MSG_NOSIGNAL` (Linux) or set `SO_NOSIGPIPE` (macOS).

### 24.6 Inter-process communication

Pipes and Unix domain sockets go through the kernel (microseconds). Shared memory (`shm_open` + `mmap`, or a mapped file in `/dev/shm`) with a lock-free ring buffer is the fastest IPC: no syscalls per message, latency comparable to inter-thread queues. Store offsets, not pointers, in shared memory, because each process may map it at a different address. Market data distribution between processes on one host often works this way.

## Predict

**P1** On Linux with 4 KB pages, `char* p = static_cast<char*>(malloc(1 << 30));` then writing one byte every 4096 bytes. How many page faults occur, and what is the resident memory before the loop? What changes on an Apple Silicon Mac?

**P2**

```cpp kind=fragment run=none
int x = 1;
if (fork() == 0) { x = 2; _exit(0); }
wait(nullptr);
printf("%d", x);
```

**P3** Output redirected to a file:

```cpp kind=fragment run=none
printf("a");
fork();
printf("b\n");
```

**P4** Does `clock_gettime(CLOCK_MONOTONIC, &ts)` enter the kernel on x86-64 Linux?

**P5** A parent creates a `MAP_SHARED | MAP_ANONYMOUS` mapping, forks, and the child writes 42 into it. What does the parent read? And with `MAP_PRIVATE`?

## Spot the bug

**B1**

```cpp kind=fragment run=none
void on_sigterm(int) {
    printf("shutting down\n");
    flush_positions();     // allocates and locks
    exit(0);
}
```

**B2**

```cpp kind=fragment run=none
struct SharedBook { Level* best_bid; Level levels[1024]; };
// placed in shared memory and read by another process
```

**B3**

```cpp kind=fragment run=none
ssize_t n = send(fd, buf, len, 0);   // peer may have disconnected
```

**B4** The strategy thread allocates a 2 GB order history buffer at startup and writes to it for the first time when the market opens.

**B5**

```cpp kind=fragment run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
std::thread logger(run_logger);
if (fork() == 0) { log("child started"); exec_worker(); }
```

## Exercises

**E1 ★ Syscall cost.** On Linux, time `syscall(SYS_getpid)` in a loop vs `clock_gettime` (vDSO). On macOS, compare `getppid()` with `mach_absolute_time()`.

**E2 ★★ Page faults.** Allocate 1 GB, time the first and second write passes, and read fault counts with `getrusage` (`ru_minflt`). On Linux, repeat with `MAP_POPULATE` and with huge pages.

**E3 ★★ Shared-memory IPC.** Put your SPSC ring (Module 19) in a `shm_open` region using offsets, and measure round-trip latency between two processes vs a Unix domain socket and a pipe.

**E4 ★★ Context switch cost.** Ping-pong between two threads using a condition variable vs spinning on an atomic, and measure round-trip time. Explain the gap.

**E5 ★★★ A small allocator.** Implement a malloc with size-class free lists over `mmap`'d chunks and per-thread caches, and compare it with the system allocator on a multi-threaded allocation benchmark.

## Interview questions

1. Process vs thread?
2. What happens on a page fault? Minor vs major?
3. What is the TLB and what happens on a miss?
4. What is `mmap` used for?
5. What does a syscall cost, and what is the vDSO?
6. What does a context switch cost, and why?
7. How does `fork` work, and why is it dangerous in a multithreaded program?
8. What does `malloc` do internally?
9. What's the fastest way to communicate between processes on one machine?
10. What may a signal handler do?
11. How do trading firms reduce OS jitter?

## Answer key

### Predict

| # | Answer | Why |
| --- | --- | --- |
| P1 | About 262,144 minor faults; resident memory near zero before the loop | One fault per 4 KB page on first touch. With 16 KB pages on Apple Silicon, about 65,536. |
| P2 | `1` | The child writes its own copy-on-write page. |
| P3 | `ab` printed twice | When redirected, stdout is fully buffered; the unflushed "a" is duplicated by `fork`. On a terminal (line-buffered) it's also duplicated, since "a" has no newline. |
| P4 | Usually not | The vDSO reads the clock in user space. |
| P5 | 42; with `MAP_PRIVATE`: the original value | Shared mappings share physical pages; private ones are copy-on-write. |

### Spot the bug

- **B1:** `printf`, allocation, locks and `exit` aren't async-signal-safe; if the signal lands while the main thread holds the malloc lock, it deadlocks. Set an atomic flag in the handler and shut down from the main loop (or use `signalfd`).
- **B2:** A raw pointer is meaningless in another process that maps the segment at a different address. Store an index or offset.
- **B3:** If the peer closed, `send` raises `SIGPIPE` and kills the process. Use `MSG_NOSIGNAL` (Linux), `SO_NOSIGPIPE` (macOS), or ignore `SIGPIPE`, then handle `EPIPE`.
- **B4:** First touch at market open triggers hundreds of thousands of page faults exactly when latency matters. Prefault (write every page) and `mlock` at startup, ideally with huge pages.
- **B5:** The child has only the forking thread; if the logger thread held a lock used by `log()`, the child deadlocks. Fork before starting threads, or call only async-signal-safe functions before `exec`.

### Exercise hints

- **E2:** The second pass is typically many times faster; the difference divided by the page count gives the per-fault cost.
- **E4:** Expect roughly microseconds per round trip with condition variables (two sleeps and wakes) vs tens to hundreds of nanoseconds spinning.

### Interview questions

1. A process owns an address space and resources; threads within it share them and differ only in stack, registers and thread-local storage.
2. The CPU traps when a mapping is missing; the kernel finds or allocates a physical page (zeroing it, or reading it from disk), updates the page table, and resumes. Minor: no disk I/O; major: disk I/O.
3. A cache of address translations. On a miss, hardware walks the page tables (several dependent memory accesses), which can take tens to hundreds of cycles.
4. Mapping files for fast I/O, allocating large anonymous memory, shared memory between processes, and loading libraries.
5. A transition to kernel mode and back, around 100–300 ns for trivial calls, more with mitigations. The vDSO is kernel code mapped into user space so calls like `clock_gettime` avoid the transition.
6. Microseconds: saving and restoring state, scheduler work, possibly switching address spaces, plus cache and TLB pollution afterward.
7. It creates a child sharing pages copy-on-write. Only the calling thread is copied, so locks held by other threads remain held forever in the child.
8. Size-class free lists, per-thread caches, larger blocks from `brk`/`mmap`, coalescing and returning memory; occasional slow paths involve locks, syscalls and page faults.
9. Shared memory with a lock-free queue; no kernel involvement per message.
10. Only async-signal-safe operations: write to a pipe or `signalfd`, set an atomic or `sig_atomic_t` flag, `_exit`.
11. Isolated cores, pinned threads, IRQ affinity, `nohz_full`, huge pages, `mlockall`, prefaulting, disabled THP compaction and frequency scaling, kernel bypass networking, and no syscalls on the hot path.
