:::exercise{#E1 level=warm-up title="Echo"}
Write a blocking TCP echo server and client; measure round-trip time on localhost with and without `TCP_NODELAY` for the write-write-read pattern from P3.
:::

:::exercise{#E2 level=standard title="Framing codec"}
Implement length-prefixed framing over a non-blocking socket that handles partial reads and writes. Property-test it by splitting a stream at random points and checking every message is recovered exactly.
::hint
Keep a per-connection read buffer; parse as many complete frames as available and keep the remainder for the next read.
:::

:::exercise{#E3 level=standard title="Reactor"}
Build a non-blocking server handling 1,000 clients, with epoll on Linux and kqueue on macOS behind a small interface (on Windows, use WSL or a Linux VM for the epoll version). Implement both level- and edge-triggered handling and show the edge-triggered bug from P6.
:::

:::exercise{#E4 level=standard title="Multicast feed handler"}
Publish sequenced messages to a localhost multicast group on two "lines"; randomly drop and reorder packets on each. Subscribe to both, arbitrate by sequence number, detect gaps, and buffer out-of-order messages until gaps fill or time out.
::hint
Track the next expected sequence number; for each message, discard if lower (duplicate), apply if equal (then drain any buffered successors), buffer if higher and start a gap timer.
:::

:::exercise{#E5 level=interview-hard title="io\_uring"}
In a Linux VM or container with liburing, implement the echo server with io\_uring and compare throughput and latency with your epoll version.
:::
