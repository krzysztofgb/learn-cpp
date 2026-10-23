### TCP

A reliable, ordered *byte stream* over a connection.

- **No message boundaries:** two `send`s of "AB" and "CD" may arrive as "ABCD", "A" + "BCD", and so on. Every TCP protocol needs framing (length prefix or delimiter), and readers must handle partial reads; writers must handle partial writes.
- **Flow control** (receive window) and **congestion control** (slow start, congestion window) regulate sending rate.
- **Nagle's algorithm** holds small writes until earlier data is acknowledged, and interacts badly with **delayed ACKs** (the receiver waits up to \~40 ms on Linux before acknowledging): a write-write-read pattern can stall for tens of milliseconds. Set `TCP_NODELAY` on latency-sensitive sockets, or hand the kernel each message in one call: build it in one buffer, or gather the pieces with `writev`/`sendmsg`. On Linux `TCP_QUICKACK` reduces delayed ACKs.
- **Head-of-line blocking:** a lost segment stalls delivery of everything after it until it's retransmitted.
- `SO_REUSEADDR` lets a server rebind while old connections sit in `TIME_WAIT`.

### UDP and multicast

UDP sends independent datagrams: boundaries preserved, but delivery, order and duplication aren't guaranteed. Each `recv` returns exactly one datagram, never part of one or several joined. A datagram larger than the buffer you pass is truncated and the rest is discarded; the next `recv` returns the next datagram. `recvmsg` reports the truncation by setting `MSG_TRUNC` in `msg_flags`, and on Linux passing `MSG_TRUNC` as a flag to `recv` makes it return the datagram's real length.

Exchanges publish market data over UDP multicast: the sender transmits each packet once to a group address in 224.0.0.0/4, and switches and routers replicate it to every port with a subscriber. A receiver joins with `IP_ADD_MEMBERSHIP`, which announces the membership with IGMP. Reliability is layered on top: every message carries a sequence number; feeds are sent twice on separate "A" and "B" lines; the receiver arbitrates (takes the first copy of each sequence number) and detects gaps; gaps are filled from a retransmission service or by resynchronizing from a snapshot.

Why UDP for market data: a late update is worth less than a missing one, because newer data supersedes it. TCP would hold back every later packet behind a retransmission (head-of-line blocking) and would make the exchange track and resend to each subscriber; UDP lets the handler move on and recover the gap separately. Order entry is the opposite: each order must arrive exactly once and in order, and volumes per connection are small, so firms use TCP.

### Sockets API essentials

`socket`, `bind`, `listen`, `accept`, `connect`, `send`/`recv` (or `read`/`write`), `setsockopt`, `close`. Windows has the same calls in Winsock (`closesocket`, `WSAGetLastError`), plus its own extensions.

- **Return values:** `recv` returns the number of bytes received, which on TCP can be anything from 1 up to the length you asked for; 0 means the peer closed the connection in an orderly way; -1 means an error, with the reason in `errno`. `send` returns how many bytes it accepted, which can be fewer than you passed. Code that ignores either count loses or misreads data.
- **Non-blocking sockets** (`O_NONBLOCK` via `fcntl`) return -1 with `EAGAIN`/`EWOULDBLOCK` instead of sleeping when there's nothing to read or no room to write. Keep each connection's unsent bytes and offset, and resume when the multiplexer reports the socket writable.
- **Byte order:** integers on the wire are usually big-endian (*network byte order*). x86-64 is little-endian, and so are ARM machines as normally configured (Apple Silicon, AWS Graviton, Android). `htons`/`htonl` convert host to network order and `ntohs`/`ntohl` back; on a big-endian host they do nothing. In C++, `std::endian::native` (C++20) tells you the host's order and `std::byteswap` (C++23) reverses bytes.
- **Never send raw structs:** padding, endianness and alignment differ across compilers and platforms. Define the wire format field by field and encode and decode each one (:sec[raw-memory/bytes-on-the-wire]).

*Further reading:* [std::endian](https://en.cppreference.com/w/cpp/types/endian), [std::byteswap](https://en.cppreference.com/w/cpp/numeric/byteswap)

### I/O multiplexing

| Mechanism | Platform | Cost per wait | Notes |
| --- | --- | --- | --- |
| `select` | All | O(number of fds) | On POSIX, `fd_set` is a bitmap of `FD_SETSIZE` (usually 1024) bits; `FD_SET` on an fd at or above that writes past it: UB |
| `poll` | POSIX | O(number of fds) | No fd limit |
| `epoll` | Linux | O(ready events) | Level- or edge-triggered; register once, wait many times |
| `kqueue` | macOS, BSD | O(ready events) | Also handles timers, signals, file and process events |
| `io_uring` | Linux 5.1+ | Batched, often zero syscalls | Submission and completion rings shared with the kernel; `SQPOLL` lets a kernel thread poll the ring |
| IOCP | Windows | O(completions) | Completion-based; `WSAPoll` is the readiness-based alternative |

**Level-triggered** reports a socket as long as data remains. **Edge-triggered** (`EPOLLET` for epoll, `EV_CLEAR` for kqueue) reports only when new data arrives, so you must read until `EAGAIN` or risk never being told about leftover data: if no more data arrives, the next wait blocks with bytes still unread. Level-triggered is the default for both.

**Reactor** (epoll, kqueue): the loop is told a socket is *ready* and then performs the I/O itself. **Proactor** (io\_uring, Windows IOCP): you submit the operation and are told when it *completed*.

Libraries such as Boost.Asio and libuv wrap these behind one interface. A portable server usually defines a small interface of its own (register a socket, wait for events) with an epoll backend on Linux and kqueue on macOS.

> **Coming from Go?** You've used this layer already: Go's `net` package runs on the runtime's netpoller, which is epoll on Linux and kqueue on macOS underneath. A goroutine that blocks in `conn.Read` is parked until the poller reports the socket ready; in C++ you write that event loop yourself.

### Kernel bypass and timestamps

The kernel network stack (interrupt, softirq, protocol processing, copy, wakeup) adds several microseconds and jitter. Kernel bypass moves packet handling into user space with the NIC's rings mapped into the process and busy-polled: DPDK (poll-mode drivers), AMD/Solarflare OpenOnload (accelerates the normal sockets API transparently) and ef\_vi (raw frames), NVIDIA/Mellanox VMA and RDMA. This brings software wire-to-wire latency down to around a microsecond or less. The fastest strategies run on FPGAs, reaching tens of nanoseconds.

Software timestamps (`SO_TIMESTAMP`) record when the kernel saw the packet; hardware timestamps from the NIC's clock (synchronized with PTP) record when it hit the wire.

### Distance

Light in fiber covers about 200 km per millisecond; microwave links through air travel close to the speed of light in vacuum. That's why the Chicago (CME's Aurora data center) to New Jersey exchanges route has microwave links that beat fiber by about 2 ms one-way, around 4 ms vs more than 6 ms.
