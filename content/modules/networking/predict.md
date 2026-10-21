:::predict{#P1}
A client calls `send("AB")` then `send("CD")` on TCP. The server calls `recv(buf, 100)` once. What can it receive?
::answer
Any prefix of "ABCD": "A", "AB", "ABC" or "ABCD"

TCP is a byte stream with no boundaries.
:::

:::predict{#P2}
A UDP sender sends datagrams "A", "B", "C". The receiver calls `recv(buf, 100)` three times. What can it receive?
::answer
Each call returns exactly one whole datagram; any may be missing, duplicated or out of order

UDP keeps boundaries but not reliability.
:::

:::predict{#P3}
A client writes an 8-byte header, then a 100-byte body (two `send` calls), then waits for a reply, on a default Linux TCP socket. Why might each request take \~40 ms? How do you fix it?
::answer
Nagle holds the body until the header is ACKed, and the server delays its ACK (\~40 ms) waiting for more data

Set `TCP_NODELAY`, or send header and body in one write (`writev`).
:::

:::predict{#P4}
`htons(0x1234)` on your Mac, and on a big-endian machine?
::answer
`0x3412` on little-endian; `0x1234` on big-endian

It converts host to network (big-endian) order.
:::

:::predict{#P5}
A 100-byte UDP datagram arrives and you call `recv(fd, buf, 10, 0)`. Then you call it again. What do you get each time?
::answer
First call: 10 bytes (the rest is discarded, `MSG_TRUNC` flags it); second call: the next datagram (or blocks)

Each `recv` consumes one datagram.
:::

:::predict{#P6}
With edge-triggered epoll, 8 KB arrives; you read 4 KB and return to `epoll_wait`. No more data arrives. What happens?
::answer
`epoll_wait` blocks indefinitely though 4 KB is unread

Edge-triggered only fires on new arrivals; drain until `EAGAIN`.
:::
