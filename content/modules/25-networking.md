# Module 25: Networking

Market data arrives over UDP multicast and orders leave over TCP, so low-latency interviews cover both protocols, the sockets API, I/O multiplexing and kernel bypass. Your Go background helps here: you've used the sockets layer, just through `net` and the runtime's netpoller (which is epoll on Linux and kqueue on macOS underneath).

## Notes

### 25.1 TCP

A reliable, ordered *byte stream* over a connection.

- **No message boundaries:** two `send`s of "AB" and "CD" may arrive as "ABCD", "A" + "BCD", and so on. Every TCP protocol needs framing (length prefix or delimiter), and readers must handle partial reads; writers must handle partial writes.
- **Flow control** (receive window) and **congestion control** (slow start, congestion window) regulate sending rate.
- **Nagle's algorithm** holds small writes until earlier data is acknowledged, and interacts badly with **delayed ACKs** (the receiver waits up to \~40 ms on Linux before acknowledging): a write-write-read pattern can stall for tens of milliseconds. Set `TCP_NODELAY` on latency-sensitive sockets; on Linux `TCP_QUICKACK` reduces delayed ACKs.
- **Head-of-line blocking:** a lost segment stalls delivery of everything after it until it's retransmitted.
- `SO_REUSEADDR` lets a server rebind while old connections sit in `TIME_WAIT`.

### 25.2 UDP and multicast

UDP sends independent datagrams: boundaries preserved, but delivery, order and duplication aren't guaranteed. A datagram larger than the receive buffer you pass is truncated (the rest is discarded).

Exchanges publish market data over UDP multicast: one packet reaches every subscriber, joined with `IP_ADD_MEMBERSHIP` (IGMP) to a group address in 224.0.0.0/4. Reliability is layered on top: every message carries a sequence number; feeds are sent twice on separate "A" and "B" lines; the receiver arbitrates (takes the first copy of each sequence number) and detects gaps; gaps are filled from a retransmission service or by resynchronizing from a snapshot.

### 25.3 Sockets API essentials

`socket`, `bind`, `listen`, `accept`, `connect`, `send`/`recv` (or `read`/`write`), `setsockopt`, `close`. Make sockets non-blocking (`O_NONBLOCK`), so calls return `EAGAIN`/`EWOULDBLOCK` instead of sleeping. Integers on the wire are usually big-endian (network byte order): `htons`, `htonl`, `ntohl`. Never send raw structs: padding, endianness and alignment differ across platforms.

### 25.4 I/O multiplexing

| Mechanism | Platform | Cost per wait | Notes |
| --- | --- | --- | --- |
| `select` | All | O(number of fds) | Limited to `FD_SETSIZE` (usually 1024); fds above that overflow the set: UB |
| `poll` | POSIX | O(number of fds) | No fd limit |
| `epoll` | Linux | O(ready events) | Level- or edge-triggered; register once, wait many times |
| `kqueue` | macOS, BSD | O(ready events) | Also handles timers, signals, file and process events |
| `io_uring` | Linux 5.1+ | Batched, often zero syscalls | Submission and completion rings shared with the kernel; `SQPOLL` lets a kernel thread poll the ring |

**Level-triggered** reports a socket as long as data remains. **Edge-triggered** reports only when new data arrives, so you must read until `EAGAIN` or risk never being told about leftover data.

**Reactor** (epoll, kqueue): the loop is told a socket is *ready* and then performs the I/O itself. **Proactor** (io\_uring, Windows IOCP): you submit the operation and are told when it *completed*.

### 25.5 Kernel bypass and timestamps

The kernel network stack (interrupt, softirq, protocol processing, copy, wakeup) adds several microseconds and jitter. Kernel bypass moves packet handling into user space with the NIC's rings mapped into the process and busy-polled: DPDK (poll-mode drivers), AMD/Solarflare OpenOnload (accelerates the normal sockets API transparently) and ef\_vi (raw frames), NVIDIA/Mellanox VMA and RDMA. This brings software wire-to-wire latency down to around a microsecond or less. The fastest strategies run on FPGAs, reaching tens of nanoseconds.

Software timestamps (`SO_TIMESTAMP`) record when the kernel saw the packet; hardware timestamps from the NIC's clock (synchronized with PTP) record when it hit the wire.

### 25.6 Distance

Light in fiber covers about 200 km per millisecond; microwave links through air travel close to the speed of light in vacuum. That's why the Chicago (CME's Aurora data center) to New Jersey exchanges route has microwave links that beat fiber by about 2 ms one-way, around 4 ms vs more than 6 ms.

## Predict

**P1** A client calls `send("AB")` then `send("CD")` on TCP. The server calls `recv(buf, 100)` once. What can it receive?

**P2** A UDP sender sends datagrams "A", "B", "C". The receiver calls `recv(buf, 100)` three times. What can it receive?

**P3** A client writes an 8-byte header, then a 100-byte body (two `send` calls), then waits for a reply, on a default Linux TCP socket. Why might each request take \~40 ms? How do you fix it?

**P4** `htons(0x1234)` on your Mac, and on a big-endian machine?

**P5** A 100-byte UDP datagram arrives and you call `recv(fd, buf, 10, 0)`. Then you call it again. What do you get each time?

**P6** With edge-triggered epoll, 8 KB arrives; you read 4 KB and return to `epoll_wait`. No more data arrives. What happens?

## Spot the bug

**B1**

```cpp kind=fragment run=none
Header h;
recv(fd, &h, sizeof(h), 0);
process(h);
```

**B2**

```cpp kind=fragment run=none
send(fd, buf.data(), buf.size(), 0);   // non-blocking socket, return value ignored
```

**B3**

```cpp kind=fragment run=none
void on_packet(const Packet& p) {
    for (auto& msg : decode(p)) book.apply(msg);   // no sequence check
}
```

**B4**

```cpp kind=fragment run=none
struct Msg { uint32_t seq; uint16_t type; uint64_t px; };
send(fd, &msg, sizeof(msg), 0);        // received by a different platform
```

**B5**

```cpp kind=fragment run=none
fd_set set; FD_ZERO(&set);
FD_SET(fd, &set);                       // fd == 3000
select(fd + 1, &set, nullptr, nullptr, nullptr);
```

## Exercises

**E1 ★ Echo.** Write a blocking TCP echo server and client; measure round-trip time on localhost with and without `TCP_NODELAY` for the write-write-read pattern from P3.

**E2 ★★ Framing codec.** Implement length-prefixed framing over a non-blocking socket that handles partial reads and writes. Property-test it by splitting a stream at random points and checking every message is recovered exactly.

**E3 ★★ Reactor.** Build a non-blocking server with kqueue on your Mac (and epoll on Linux behind a small interface) handling 1,000 clients. Implement both level- and edge-triggered handling and show the edge-triggered bug from P6.

**E4 ★★ Multicast feed handler.** Publish sequenced messages to a localhost multicast group on two "lines"; randomly drop and reorder packets on each. Subscribe to both, arbitrate by sequence number, detect gaps, and buffer out-of-order messages until gaps fill or time out.

**E5 ★★★ io\_uring.** In a Linux VM or container with liburing, implement the echo server with io\_uring and compare throughput and latency with your epoll version.

## Interview questions

1. TCP vs UDP: which for market data and which for order entry, and why?
2. What are Nagle's algorithm and `TCP_NODELAY`?
3. What is head-of-line blocking?
4. How does multicast work, and how do feed handlers deal with packet loss?
5. Compare `select`, `poll`, `epoll`, `kqueue` and `io_uring`.
6. Edge- vs level-triggered: what can go wrong with edge-triggered?
7. Reactor vs proactor?
8. How does kernel bypass work, and what does it save?
9. Where does latency come from in the kernel network path?
10. How do you handle partial reads and writes?
11. Hardware vs software timestamps?

## Answer key

### Predict

| # | Answer | Why |
| --- | --- | --- |
| P1 | Any prefix of "ABCD": "A", "AB", "ABC" or "ABCD" | TCP is a byte stream with no boundaries. |
| P2 | Each call returns exactly one whole datagram; any may be missing, duplicated or out of order | UDP keeps boundaries but not reliability. |
| P3 | Nagle holds the body until the header is ACKed, and the server delays its ACK (\~40 ms) waiting for more data | Set `TCP_NODELAY`, or send header and body in one write (`writev`). |
| P4 | `0x3412` on little-endian; `0x1234` on big-endian | It converts host to network (big-endian) order. |
| P5 | First call: 10 bytes (the rest is discarded, `MSG_TRUNC` flags it); second call: the next datagram (or blocks) | Each `recv` consumes one datagram. |
| P6 | `epoll_wait` blocks indefinitely though 4 KB is unread | Edge-triggered only fires on new arrivals; drain until `EAGAIN`. |

### Spot the bug

- **B1:** TCP may return fewer bytes than `sizeof(h)`; the code processes a partially filled header. Loop until the full header arrives, and check for 0 (peer closed) and errors.
- **B2:** A non-blocking `send` may write only part of the buffer or fail with `EAGAIN`; unsent bytes are silently lost. Track the offset and resume when writable.
- **B3:** Lost, duplicated or reordered packets corrupt the book silently. Check sequence numbers, drop duplicates, buffer out-of-order messages, and recover gaps.
- **B4:** Padding, endianness and alignment may differ on the receiver. Define the wire format explicitly and encode/decode each field.
- **B5:** `FD_SET` with fd ≥ `FD_SETSIZE` writes past the end of `fd_set`: UB (memory corruption). Use `poll`, `epoll` or `kqueue`.

### Exercise hints

- **E2:** Keep a per-connection read buffer; parse as many complete frames as available and keep the remainder for the next read.
- **E4:** Track the next expected sequence number; for each message, discard if lower (duplicate), apply if equal (then drain any buffered successors), buffer if higher and start a gap timer.

### Interview questions

1. Market data: UDP multicast, because one packet reaches all subscribers with no retransmission delays, and staleness is worse than loss (gaps are recovered separately). Orders: TCP, because each order must arrive exactly once and in order; volumes are low, so TCP's overhead is acceptable.
2. Nagle delays small writes until outstanding data is acknowledged to reduce tiny packets. `TCP_NODELAY` disables it so writes go out immediately.
3. A missing segment blocks delivery of all later data on the connection until retransmitted.
4. The sender transmits once to a group address; routers replicate to subscribers that joined via IGMP. Handlers use sequence numbers, A/B line arbitration, gap detection, retransmission requests and snapshot recovery.
5. See table 25.4: `select`/`poll` scan every fd on every call; `epoll`/`kqueue` maintain interest sets in the kernel and return only ready fds; `io_uring` submits and completes I/O through shared rings with batching and optional kernel polling.
6. Level-triggered keeps reporting while data remains; edge-triggered reports only transitions, so failing to drain loses notification of remaining data.
7. Reactor: you're notified of readiness and perform I/O yourself. Proactor: you submit I/O and are notified on completion.
8. The NIC's queues are mapped into user space and polled; the application processes raw packets with its own (or an accelerated) protocol stack. It saves interrupts, context switches, copies and kernel protocol overhead.
9. Interrupt handling, softirq processing, protocol layers, socket buffer copies, scheduler wakeup of the receiving thread, and the syscall to read.
10. Loop until the full amount is transferred, keeping per-connection buffers and offsets; on `EAGAIN`, wait for readiness and resume.
11. Software timestamps are taken in the kernel (after interrupt and processing delays); hardware timestamps come from the NIC's PTP-synchronized clock when the packet hits the wire, giving true wire times.
