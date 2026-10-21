:::exercise{#E1 level=warm-up title="False sharing"}
Implement P5 and measure with no padding, 64-byte and 128-byte separation on your Mac. Explain why 64 isn't enough there.
:::

:::exercise{#E2 level=standard title="SPSC queue"}
Implement the queue from :sec[lock-free-programming/spsc-ring-buffer] with cached indices and padding. Measure throughput (items/s) and round-trip latency with two queues in a ping-pong, against a mutex-protected `std::deque`. Run under TSan.
::hint
Typical results: well under 10 ns per item for SPSC throughput; round-trip latency dominated by cache-line transfers between the two cores (around 50–200 ns depending on the machine).
:::

:::exercise{#E3 level=standard title="ABA live"}
Implement a Treiber stack without protection and a stress test that detects corruption (use a free list instead of `delete` so addresses get reused quickly). Then fix it with a tagged pointer.
::hint
Pack a 16-bit tag in the top bits of a 64-bit pointer (user addresses fit in 48 bits), or use `std::atomic` of a 16-byte struct and check it's lock-free.
:::

:::exercise{#E4 level=standard title="Seqlock"}
Implement a seqlock protecting `TopOfBook {bid_px, bid_qty, ask_px, ask_qty}` with one writer and four readers, with atomic relaxed payload accesses and correct fences. Verify readers never observe a torn snapshot (e.g. an invariant between fields the writer maintains).
::hint
Writer: `seq.store(s + 1, relaxed); atomic_thread_fence(release);` write fields relaxed; `seq.store(s + 2, release)`. Reader: `s1 = seq.load(acquire);` read fields relaxed; `atomic_thread_fence(acquire); s2 = seq.load(relaxed);`.
:::

:::exercise{#E5 level=interview-hard title="Vyukov MPMC queue"}
Implement the bounded MPMC queue with per-slot sequence numbers. Compare throughput against your SPSC queue and a mutex queue at 1, 2 and 4 producers.
:::

:::exercise{#E6 level=interview-hard title="Hazard pointers"}
Implement single-slot-per-thread hazard pointers with retire lists and periodic scans, and use them to make your Treiber stack's `pop` safe to `delete`.
:::
