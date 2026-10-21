### TCP

A reliable, ordered *byte stream* over a connection.

- **No message boundaries:** two `send`s of "AB" and "CD" may arrive as "ABCD", "A" + "BCD", and so on. Every TCP protocol needs framing (length prefix or delimiter), and readers must handle partial reads; writers must handle partial writes.
- **Flow control** (receive window) and **congestion control** (slow start, congestion window) regulate sending rate.
- **Nagle's algorithm** holds small writes until earlier data is acknowledged, and interacts badly with **delayed ACKs** (the receiver waits up to \~40 ms on Linux before acknowledging): a write-write-read pattern can stall for tens of milliseconds. Set `TCP_NODELAY` on latency-sensitive sockets; on Linux `TCP_QUICKACK` reduces delayed ACKs.
- **Head-of-line blocking:** a lost segment stalls delivery of everything after it until it's retransmitted.
- `SO_REUSEADDR` lets a server rebind while old connections sit in `TIME_WAIT`.

### UDP and multicast

UDP sends independent datagrams: boundaries preserved, but delivery, order and duplication aren't guaranteed. A datagram larger than the receive buffer you pass is truncated (the rest is discarded).

Exchanges publish market data over UDP multicast: one packet reaches every subscriber, joined with `IP_ADD_MEMBERSHIP` (IGMP) to a group address in 224.0.0.0/4. Reliability is layered on top: every message carries a sequence number; feeds are sent twice on separate "A" and "B" lines; the receiver arbitrates (takes the first copy of each sequence number) and detects gaps; gaps are filled from a retransmission service or by resynchronizing from a snapshot.

### Sockets API essentials

`socket`, `bind`, `listen`, `accept`, `connect`, `send`/`recv` (or `read`/`write`), `setsockopt`, `close`. Make sockets non-blocking (`O_NONBLOCK`), so calls return `EAGAIN`/`EWOULDBLOCK` instead of sleeping. Integers on the wire are usually big-endian (network byte order): `htons`, `htonl`, `ntohl`. Never send raw structs: padding, endianness and alignment differ across platforms.

### I/O multiplexing

| Mechanism | Platform | Cost per wait | Notes |
| --- | --- | --- | --- |
| `select` | All | O(number of fds) | Limited to `FD_SETSIZE` (usually 1024); fds above that overflow the set: UB |
| `poll` | POSIX | O(number of fds) | No fd limit |
| `epoll` | Linux | O(ready events) | Level- or edge-triggered; register once, wait many times |
| `kqueue` | macOS, BSD | O(ready events) | Also handles timers, signals, file and process events |
| `io_uring` | Linux 5.1+ | Batched, often zero syscalls | Submission and completion rings shared with the kernel; `SQPOLL` lets a kernel thread poll the ring |

**Level-triggered** reports a socket as long as data remains. **Edge-triggered** reports only when new data arrives, so you must read until `EAGAIN` or risk never being told about leftover data.

**Reactor** (epoll, kqueue): the loop is told a socket is *ready* and then performs the I/O itself. **Proactor** (io\_uring, Windows IOCP): you submit the operation and are told when it *completed*.

### Kernel bypass and timestamps

The kernel network stack (interrupt, softirq, protocol processing, copy, wakeup) adds several microseconds and jitter. Kernel bypass moves packet handling into user space with the NIC's rings mapped into the process and busy-polled: DPDK (poll-mode drivers), AMD/Solarflare OpenOnload (accelerates the normal sockets API transparently) and ef\_vi (raw frames), NVIDIA/Mellanox VMA and RDMA. This brings software wire-to-wire latency down to around a microsecond or less. The fastest strategies run on FPGAs, reaching tens of nanoseconds.

Software timestamps (`SO_TIMESTAMP`) record when the kernel saw the packet; hardware timestamps from the NIC's clock (synchronized with PTP) record when it hit the wire.

### Distance

Light in fiber covers about 200 km per millisecond; microwave links through air travel close to the speed of light in vacuum. That's why the Chicago (CME's Aurora data center) to New Jersey exchanges route has microwave links that beat fiber by about 2 ms one-way, around 4 ms vs more than 6 ms.
