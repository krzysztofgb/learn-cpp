:::bug{#B1}
```cpp run=none
Header h;
recv(fd, &h, sizeof(h), 0);
process(h);
```
::answer
TCP may return fewer bytes than `sizeof(h)`; the code processes a partially filled header. Loop until the full header arrives, and check for 0 (peer closed) and errors.
:::

:::bug{#B2}
```cpp run=none
send(fd, buf.data(), buf.size(), 0);   // non-blocking socket, return value ignored
```
::answer
A non-blocking `send` may write only part of the buffer or fail with `EAGAIN`; unsent bytes are silently lost. Track the offset and resume when writable.
:::

:::bug{#B3}
```cpp run=none
void on_packet(const Packet& p) {
    for (auto& msg : decode(p)) book.apply(msg);   // no sequence check
}
```
::answer
Lost, duplicated or reordered packets corrupt the book silently. Check sequence numbers, drop duplicates, buffer out-of-order messages, and recover gaps.
:::

:::bug{#B4}
```cpp run=none
struct Msg { uint32_t seq; uint16_t type; uint64_t px; };
send(fd, &msg, sizeof(msg), 0);        // received by a different platform
```
::answer
Padding, endianness and alignment may differ on the receiver. Define the wire format explicitly and encode/decode each field.
:::

:::bug{#B5}
```cpp run=none
fd_set set; FD_ZERO(&set);
FD_SET(fd, &set);                       // fd == 3000
select(fd + 1, &set, nullptr, nullptr, nullptr);
```
::answer
`FD_SET` with fd ≥ `FD_SETSIZE` writes past the end of `fd_set`: UB (memory corruption). Use `poll`, `epoll` or `kqueue`.
:::
