:::question{#Q1}
TCP vs UDP: which for market data and which for order entry, and why?
::answer
Market data: UDP multicast, because one packet reaches all subscribers with no retransmission delays, and staleness is worse than loss (gaps are recovered separately). Orders: TCP, because each order must arrive exactly once and in order; volumes are low, so TCP's overhead is acceptable.
:::

:::question{#Q2}
What are Nagle's algorithm and `TCP_NODELAY`?
::answer
Nagle delays small writes until outstanding data is acknowledged to reduce tiny packets. `TCP_NODELAY` disables it so writes go out immediately.
:::

:::question{#Q3}
What is head-of-line blocking?
::answer
A missing segment blocks delivery of all later data on the connection until retransmitted.
:::

:::question{#Q4}
How does multicast work, and how do feed handlers deal with packet loss?
::answer
The sender transmits once to a group address; routers replicate to subscribers that joined via IGMP. Handlers use sequence numbers, A/B line arbitration, gap detection, retransmission requests and snapshot recovery.
:::

:::question{#Q5}
Compare `select`, `poll`, `epoll`, `kqueue` and `io_uring`.
::answer
See :sec[networking/i-o-multiplexing]: `select`/`poll` scan every fd on every call; `epoll`/`kqueue` maintain interest sets in the kernel and return only ready fds; `io_uring` submits and completes I/O through shared rings with batching and optional kernel polling.
:::

:::question{#Q6}
Edge- vs level-triggered: what can go wrong with edge-triggered?
::answer
Level-triggered keeps reporting while data remains; edge-triggered reports only transitions, so failing to drain loses notification of remaining data.
:::

:::question{#Q7}
Reactor vs proactor?
::answer
Reactor: you're notified of readiness and perform I/O yourself. Proactor: you submit I/O and are notified on completion.
:::

:::question{#Q8}
How does kernel bypass work, and what does it save?
::answer
The NIC's queues are mapped into user space and polled; the application processes raw packets with its own (or an accelerated) protocol stack. It saves interrupts, context switches, copies and kernel protocol overhead.
:::

:::question{#Q9}
Where does latency come from in the kernel network path?
::answer
Interrupt handling, softirq processing, protocol layers, socket buffer copies, scheduler wakeup of the receiving thread, and the syscall to read.
:::

:::question{#Q10}
How do you handle partial reads and writes?
::answer
Loop until the full amount is transferred, keeping per-connection buffers and offsets; on `EAGAIN`, wait for readiness and resume.
:::

:::question{#Q11}
Hardware vs software timestamps?
::answer
Software timestamps are taken in the kernel (after interrupt and processing delays); hardware timestamps come from the NIC's PTP-synchronized clock when the packet hits the wire, giving true wire times.
:::
