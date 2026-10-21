:::exercise{#E1 level=warm-up title="FIX parser"}
Parse a FIX message into a fixed array of `(tag, std::string_view)` pairs without allocating. Validate BodyLength (9) and CheckSum (10), and reject malformed messages.
::hint
Compute the checksum over every byte up to and including the SOH before `10=`, then compare with the three-digit value.
:::

:::exercise{#E2 level=standard title="ITCH decoder"}
Decode ITCH 5.0 messages `A`, `F`, `E`, `C`, `X`, `D`, `U` and `P` from a byte stream using the spec's field offsets, with `memcpy` and byte swaps. NASDAQ publishes sample ITCH files; measure your decode rate in millions of messages per second.
:::

:::exercise{#E3 level=standard title="L3 book from ITCH"}
Feed decoded messages into the order book from :mod[low-latency-techniques], maintain the BBO, and check invariants (best bid below best ask, level quantities equal the sum of their orders) after each message in debug builds.
:::

:::exercise{#E4 level=standard title="Matching engine"}
Implement price-time priority matching for limit, market, IOC and FOK orders, plus cancel and modify with correct priority rules. Write a unit test for every rule in :sec[trading-domain/matching].
::hint
Keep a FIFO per price level; for FOK, check total available quantity at acceptable prices before executing anything.
:::

:::exercise{#E5 level=standard title="Risk gate"}
Implement O(1), allocation-free checks: max quantity, max notional (with overflow-safe arithmetic), price collar against a reference, position limit, and a token-bucket message throttle. Benchmark the per-order cost.
::hint
Precompute limits per instrument in a flat array indexed by instrument ID; a token bucket needs only a timestamp and a counter.
:::

:::exercise{#E6 level=interview-hard title="Tick-to-trade pipeline"}
Chain a UDP feed simulator, decoder, book, a toy strategy (e.g. send an order when the spread narrows), risk checks and an OUCH-like encoder. Timestamp each stage and report a latency histogram for each.
:::
