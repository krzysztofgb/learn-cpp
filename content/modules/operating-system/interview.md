:::question{#Q1}
Process vs thread?
::answer
A process owns an address space and resources; threads within it share them and differ only in stack, registers and thread-local storage.
:::

:::question{#Q2}
What happens on a page fault? Minor vs major?
::answer
The CPU traps when a mapping is missing; the kernel finds or allocates a physical page (zeroing it, or reading it from disk), updates the page table, and resumes. Minor: no disk I/O; major: disk I/O.
:::

:::question{#Q3}
What is the TLB and what happens on a miss?
::answer
A cache of address translations. On a miss, hardware walks the page tables (several dependent memory accesses), which can take tens to hundreds of cycles.
:::

:::question{#Q4}
What is `mmap` used for?
::answer
Mapping files for fast I/O, allocating large anonymous memory, shared memory between processes, and loading libraries.
:::

:::question{#Q5}
What does a syscall cost, and what is the vDSO?
::answer
A transition to kernel mode and back, around 100–300 ns for trivial calls, more with mitigations. The vDSO is kernel code mapped into user space so calls like `clock_gettime` avoid the transition.
:::

:::question{#Q6}
What does a context switch cost, and why?
::answer
Microseconds: saving and restoring state, scheduler work, possibly switching address spaces, plus cache and TLB pollution afterward.
:::

:::question{#Q7}
How does `fork` work, and why is it dangerous in a multithreaded program?
::answer
It creates a child sharing pages copy-on-write. Only the calling thread is copied, so locks held by other threads remain held forever in the child.
:::

:::question{#Q8}
What does `malloc` do internally?
::answer
Size-class free lists, per-thread caches, larger blocks from `brk`/`mmap`, coalescing and returning memory; occasional slow paths involve locks, syscalls and page faults.
:::

:::question{#Q9}
What's the fastest way to communicate between processes on one machine?
::answer
Shared memory with a lock-free queue; no kernel involvement per message.
:::

:::question{#Q10}
What may a signal handler do?
::answer
Only async-signal-safe operations: write to a pipe or `signalfd`, set an atomic or `sig_atomic_t` flag, `_exit`.
:::

:::question{#Q11}
How do trading firms reduce OS jitter?
::answer
Isolated cores, pinned threads, IRQ affinity, `nohz_full`, huge pages, `mlockall`, prefaulting, disabled THP compaction and frequency scaling, kernel bypass networking, and no syscalls on the hot path.
:::
