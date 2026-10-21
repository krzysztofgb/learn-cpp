:::exercise{#E1 level=warm-up title="Allocation tripwire"}
Replace global `operator new` to count allocations per thread. Write a test asserting that processing 1M synthetic market-data messages performs zero allocations after warm-up.
::hint
Use a `thread_local` counter in your `operator new`, and remember `operator new[]` and the aligned overloads too.
:::

:::exercise{#E2 level=standard title="Arena per batch"}
Build `MarketEvent` objects for each batch in a `monotonic_buffer_resource` that's reset after the batch. Compare throughput and tail latency against default allocation.
:::

:::exercise{#E3 level=standard title="Low-latency logger"}
The hot thread writes a record (timestamp, format-string pointer, raw argument bytes) into an SPSC ring; a background thread formats and writes it. Measure the hot-path cost per log call in nanoseconds, compared with formatting inline.
::hint
Copy arguments as raw bytes with their types encoded in the format-string descriptor (known at compile time), so the hot path is a few stores.
:::

:::exercise{#E4 level=standard title="Branchless toolkit"}
Implement branchless `min`, `max`, `abs`, `clamp` and `select(cond, a, b)` with masks, compare their assembly with `std::` versions, and benchmark on random vs predictable inputs.
:::

:::exercise{#E5 level=standard title="PGO and LTO"}
Take one earlier benchmark (an order book or a parser), build it plain, with LTO, with PGO, and with both. Record speedups and inspect what changed (inlining decisions, block layout).
:::

:::exercise{#E6 level=interview-hard title="Fast order book"}
Implement the design in :sec[low-latency-techniques/order-book-implementation-sketch] supporting add, cancel, modify and execute, plus best bid/ask queries. Drive it with a synthetic stream (e.g. 60% adds, 35% cancels, 5% executes, concentrated near the top of book) and target under 100 ns median per operation on your Mac. Report p50, p99 and p99.9.
::hint
Typical bottlenecks are the ID map and cancel; an intrusive list makes cancel O(1) and the map lookup becomes the dominant cost.
:::
