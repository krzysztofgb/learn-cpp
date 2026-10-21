### Processes and threads

A process has its own address space, file descriptors and credentials; threads share all of that but have their own stack, registers and thread-local storage. Linux implements both as tasks (`clone` with different sharing flags).

`fork()` duplicates the address space lazily with copy-on-write: pages are shared read-only until either side writes. In a multithreaded program, only the calling thread exists in the child, so mutexes held by other threads stay locked forever; the child should only call async-signal-safe functions until it `exec`s.

### Virtual memory

Each process sees a virtual address space mapped to physical pages by multi-level page tables (4 levels on x86-64), cached by the TLB (:mod[hardware]).

- **Demand paging:** `malloc` or `mmap` of a large region only reserves addresses; physical pages are assigned on first touch.
- **Minor fault:** the page is in memory (or just needs zeroing) but not mapped yet, costing roughly 0.5–2 µs including zeroing. **Major fault:** the page must be read from disk, costing milliseconds.
- **Overcommit:** Linux may promise more memory than exists and invoke the OOM killer later.
- **`mmap`:** maps files or anonymous memory; `MAP_SHARED` changes are visible to other mappers and backed by the file, `MAP_PRIVATE` is copy-on-write. `MAP_POPULATE` prefaults, `MAP_HUGETLB` uses huge pages. `mlock`/`mlockall` pin pages so they're never swapped out.
- **Transparent huge pages** can help TLB reach, but background compaction (`khugepaged`) can cause latency spikes; many firms use explicit huge pages and disable THP defragmentation.
- macOS on Apple Silicon uses 16 KB pages and has no `MAP_POPULATE`.

### Allocators

`malloc` implementations (glibc ptmalloc, jemalloc, tcmalloc, mimalloc) keep size-class free lists and per-thread caches, obtain memory from the kernel with `brk` or `mmap`, and occasionally return it. Usually fast (tens of ns), but sometimes a call takes a syscall, a page fault or a lock, which is why hot paths avoid it (:mod[low-latency-techniques]).

### System calls and context switches

- A syscall switches to kernel mode and back: roughly 100 ns to a few hundred ns for trivial calls, more with security mitigations. The vDSO maps some calls (like `clock_gettime`) into user space, so they cost no syscall.
- A context switch saves and restores registers and may switch page tables: a few microseconds including cache and TLB disruption.
- Linux schedulers (CFS, now EEVDF) time-slice normal threads; `SCHED_FIFO` real-time threads run until they block. Isolated cores (`isolcpus`, `nohz_full`) keep the scheduler tick and other tasks off critical cores.
- **Interrupts** from NICs and timers preempt whatever runs on a core; steer them away from critical cores with IRQ affinity.

### Signals

Signals interrupt a thread asynchronously. Handlers may only call async-signal-safe functions (`write`, `_exit`, setting a `volatile std::sig_atomic_t` or lock-free atomic): no `printf`, `malloc` or mutexes. Writing to a socket whose peer closed raises `SIGPIPE`, which kills the process by default; ignore it, or pass `MSG_NOSIGNAL` (Linux) or set `SO_NOSIGPIPE` (macOS).

### Inter-process communication

Pipes and Unix domain sockets go through the kernel (microseconds). Shared memory (`shm_open` + `mmap`, or a mapped file in `/dev/shm`) with a lock-free ring buffer is the fastest IPC: no syscalls per message, latency comparable to inter-thread queues. Store offsets, not pointers, in shared memory, because each process may map it at a different address. Market data distribution between processes on one host often works this way.
