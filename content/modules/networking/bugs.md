:::bug{#B1 findings=ub}
```cpp run=none
Header h;
recv(fd, &h, sizeof(h), 0);
process(h);
```
::answer
UB: TCP may return fewer bytes than `sizeof(h)` (or 0 or -1), and `process` then reads members of `h` that were never written, which is UB through C++23 (erroneous behavior in C++26). Loop until the full header arrives, and check for 0 (peer closed) and errors.
:::

:::bug{#B2 findings=defined-bug}
```cpp run=none
send(fd, buf.data(), buf.size(), 0);   // non-blocking socket, return value ignored
```
::answer
Defined behavior, but data loss: a non-blocking `send` may write only part of the buffer or fail with `EAGAIN`; unsent bytes are silently lost. Track the offset and resume when writable.
:::

:::bug{#B3 findings=defined-bug}
```cpp run=none
void on_packet(const Packet& p) {
    for (auto& msg : decode(p)) book.apply(msg);   // no sequence check
}
```
::answer
Defined behavior, but wrong results: lost, duplicated or reordered packets corrupt the book silently. Check sequence numbers, drop duplicates, buffer out-of-order messages, and recover gaps.
:::

:::bug{#B4 findings=unspecified}
```cpp run=none
struct Msg { uint32_t seq; uint16_t type; uint64_t px; };
send(fd, &msg, sizeof(msg), 0);        // received by a different platform
```
::answer
Implementation-defined layout: padding, endianness and alignment may differ on the receiver. Define the wire format explicitly and encode/decode each field.
:::

:::bug{#B5 findings=ub}
```cpp run=none
fd_set set; FD_ZERO(&set);
FD_SET(fd, &set);                       // fd == 3000
select(fd + 1, &set, nullptr, nullptr, nullptr);
```
::answer
UB: `FD_SET` with fd ≥ `FD_SETSIZE` (usually 1024) writes past the end of `fd_set`, corrupting memory. Use `poll`, `epoll` or `kqueue`.
:::
