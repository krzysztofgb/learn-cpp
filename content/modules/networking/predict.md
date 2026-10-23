:::predict{#P1}
A client calls `send("AB")` then `send("CD")` on TCP. The server calls `recv(buf, 100)` once. What can it receive?
::choices
- [ ] Exactly `AB`: one `recv` per `send`
- [ ] `AB` or `ABCD`, never a split message
- [x] Any prefix of `ABCD`: `A`, `AB`, `ABC` or `ABCD`
- [ ] Always `ABCD`: `recv` waits for more data
::answer
Any prefix of "ABCD": "A", "AB", "ABC" or "ABCD"

TCP is a byte stream with no boundaries.
:::

:::predict{#P2}
A UDP sender sends datagrams "A", "B", "C". The receiver calls `recv(buf, 100)` three times. What can it receive?
::choices
- [ ] Any split of the bytes, like TCP (`AB`, then `C`)
- [ ] `A`, `B`, `C` in order, each exactly once
- [ ] One whole datagram per call, always in send order
- [x] One whole datagram per call; any may be lost, duplicated or reordered
::answer
Each call returns exactly one whole datagram; any may be missing, duplicated or out of order

UDP keeps boundaries but not reliability.
:::

:::predict{#P3}
A client writes an 8-byte header, then a 100-byte body (two `send` calls), then waits for a reply, on a default Linux TCP socket. Why might each request take \~40 ms? How do you fix it?
::choices
- [ ] Socket buffer too small; raise `SO_SNDBUF`
- [x] Nagle plus delayed ACK; set `TCP_NODELAY` or use one write
- [ ] A 40 ms scheduler tick; pin the thread to a core
- [ ] Slow start on each request; raise the initial window
::answer
Nagle holds the body until the header is ACKed, and the server delays its ACK (\~40 ms) waiting for more data

Set `TCP_NODELAY`, or send header and body in one write (`writev`).
:::

:::predict{#P4}
`htons(0x1234)` on a typical x86-64 or ARM machine (Apple Silicon, AWS Graviton), and on a big-endian machine?
::choices
- [ ] `0x1234` on little-endian; `0x3412` on big-endian
- [x] `0x3412` on little-endian; `0x1234` on big-endian
- [ ] `0x3412` on both
- [ ] `0x1234` on both: network order is host order
::answer
`0x3412` on little-endian; `0x1234` on big-endian

It converts host to network (big-endian) order.
:::

:::predict{#P5}
A 100-byte UDP datagram arrives and you call `recv(fd, buf, 10, 0)`. Then you call it again. What do you get each time?
::choices
- [ ] 10 bytes, then the remaining 90 bytes
- [ ] An error (`EMSGSIZE`): the buffer is too small
- [x] 10 bytes (rest discarded), then the next datagram or a block
- [ ] 10 bytes both times: the datagram stays queued
::answer
First call: 10 bytes (the rest is discarded, `MSG_TRUNC` flags it); second call: the next datagram (or blocks)

Each `recv` consumes one datagram.
:::

:::predict{#P6}
With edge-triggered epoll, 8 KB arrives; you read 4 KB and return to `epoll_wait`. No more data arrives. What happens?
::choices
- [ ] `epoll_wait` returns again at once for the unread 4 KB
- [ ] The unread 4 KB is discarded
- [x] `epoll_wait` blocks indefinitely though 4 KB is unread
- [ ] `epoll_wait` fails with `EAGAIN`
::answer
`epoll_wait` blocks indefinitely though 4 KB is unread

Edge-triggered only fires on new arrivals; drain until `EAGAIN`.
:::
