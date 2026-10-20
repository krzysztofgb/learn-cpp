# Module 26: The trading domain

Interviewers for low-latency roles don't expect you to be a trader, but they expect fluency in the systems vocabulary: order books, matching, protocols, feeds and risk checks. These are also the most common design and coding exercises in onsite rounds.

## Notes

### 26.1 Orders and the book

- **Order types:** limit (a price, may rest on the book), market (take whatever is available), stop (becomes active at a trigger price), plus flags such as post-only (cancel rather than take liquidity) and iceberg (show only part of the size).
- **Time in force:** DAY, GTC (good till cancelled), IOC (fill what you can immediately, cancel the rest), FOK (fill completely immediately or cancel entirely).
- **The book:** bids sorted by price descending, asks ascending. The best bid and best offer (BBO) form the top of book; the spread is ask minus bid. Prices move in ticks (the minimum increment); quantities in lots.
- **Data levels:** L1 = top of book; L2 = aggregated quantity per price level (market by price); L3 = every individual order (market by order).

### 26.2 Matching

An incoming order that crosses the spread matches against the opposite side, best price first. Among orders at the same price, most equity venues use **price-time priority** (FIFO); some futures markets use **pro-rata** allocation (proportional to size) or hybrids. Fills happen at the resting order's price. Whatever remains of a limit order rests on the book (unless IOC or FOK).

Modifies matter for priority: reducing quantity usually keeps queue position; increasing quantity or changing price loses it (treated as cancel and replace).

### 26.3 Protocols

- **FIX:** tag=value ASCII separated by SOH (0x01), e.g. `8=FIX.4.4|9=...|35=D|...|10=123|`. Common tags: 35 MsgType (D = NewOrderSingle, 8 = ExecutionReport, F = cancel request), 55 Symbol, 54 Side (1 buy, 2 sell), 38 OrderQty, 44 Price, 40 OrdType (1 market, 2 limit), 11 ClOrdID. Tag 9 is body length; tag 10 is a checksum (sum of all preceding bytes mod 256, as three digits). The session layer handles logon, heartbeats, sequence numbers and resend requests. Flexible but slow to parse.
- **SBE (Simple Binary Encoding):** fixed-layout little-endian binary messages with schema-defined templates, used by CME's market data (MDP 3.0) and order entry (iLink 3). Fields decode with fixed offsets.
- **NASDAQ ITCH 5.0:** binary, big-endian market-by-order feed. Message types include `A` add order, `F` add with attribution, `E` executed, `C` executed with price, `X` partial cancel, `D` delete, `U` replace and `P` trade. Prices are 4-byte integers with 4 implied decimals; timestamps are 6-byte nanoseconds since midnight. Delivered over MoldUDP64 (sequenced multicast) with a retransmission server.
- **OUCH:** NASDAQ's binary order entry protocol, over SoupBinTCP.

### 26.4 Feed handling

A feed handler receives packets (A and B lines), arbitrates and orders messages by sequence number, detects gaps, recovers (retransmission request or snapshot plus replay), decodes messages, and updates books. Until a gap is recovered, an order-by-order book can't be trusted; the handler marks the instrument stale.

### 26.5 Tick-to-trade

The time from a market data packet arriving at the NIC to the resulting order packet leaving. Components: NIC to user space, decode, book update, strategy decision, pre-trade risk, order encoding, send. Competitive software systems target single-digit microseconds or less; FPGA systems, tens to hundreds of nanoseconds.

### 26.6 Pre-trade risk

Every order must pass checks before it reaches the exchange (in the US, SEC Rule 15c3-5 requires brokers to have them): maximum order size and notional, price collars against a reference price (fat-finger protection), position and exposure limits, message rate throttles, and a kill switch. They sit on the critical path, so they must be O(1) with no allocation.

### 26.7 Strategy vocabulary

Market makers quote both sides and earn the spread while managing inventory risk; their main danger is *adverse selection* (being filled by better-informed traders right before the price moves against them). Speed matters for updating or cancelling quotes before being picked off, and for taking stale quotes. Colocation puts servers in the exchange's data center: CME in Aurora, Illinois; NYSE in Mahwah, NJ; NASDAQ in Carteret, NJ.

## Predict

**P1** Asks: 100.02 × 300, 100.03 × 500. A buy limit order for 600 at 100.03 arrives. What fills, at what prices, and what's left on the book?

**P2** Same book; a buy IOC for 600 at 100.02 arrives instead. What happens?

**P3** Bids at 100.00 in time order: A 100, B 200, C 50. A market sell for 250 arrives. Who fills how much? Then A increases its order to 150. Where does A stand in the queue?

**P4** An ITCH price field contains the big-endian bytes `00 0F 42 40`. What price is that?

**P5** Decode: `35=D|55=AAPL|54=1|38=100|40=2|44=150.25|`.

**P6** The last applied sequence number is 1000. The next packet has sequence 1003 and holds two messages. What do you do?

## Spot the bug

**B1**

```cpp kind=fragment run=none
double px = read_be<uint32_t>(p + 12) / 10000.0;
book.add(side, px, qty);
```

**B2**

```cpp kind=fragment run=none
auto qty = *reinterpret_cast<const uint32_t*>(msg + 7);
```

**B3**

```cpp kind=fragment run=none
void Book::modify(Order& o, int new_qty) {
    level_of(o).qty += new_qty - o.qty;
    o.qty = new_qty;            // queue position kept for any change
}
```

**B4** On reconnect, the feed handler requests a snapshot and applies it on top of the existing book.

**B5**

```cpp kind=fragment run=none
int32_t notional = order.px_ticks * order.qty;
if (notional > limits.max_notional) reject(order);
```

**B6**

```cpp kind=fragment run=none
std::map<double, Level> bids;
```

## Exercises

**E1 ★ FIX parser.** Parse a FIX message into a fixed array of `(tag, std::string_view)` pairs without allocating. Validate BodyLength (9) and CheckSum (10), and reject malformed messages.

**E2 ★★ ITCH decoder.** Decode ITCH 5.0 messages `A`, `F`, `E`, `C`, `X`, `D`, `U` and `P` from a byte stream using the spec's field offsets, with `memcpy` and byte swaps. NASDAQ publishes sample ITCH files; measure your decode rate in millions of messages per second.

**E3 ★★ L3 book from ITCH.** Feed decoded messages into the order book from Module 22, maintain the BBO, and check invariants (best bid below best ask, level quantities equal the sum of their orders) after each message in debug builds.

**E4 ★★ Matching engine.** Implement price-time priority matching for limit, market, IOC and FOK orders, plus cancel and modify with correct priority rules. Write a unit test for every rule in 26.2.

**E5 ★★ Risk gate.** Implement O(1), allocation-free checks: max quantity, max notional (with overflow-safe arithmetic), price collar against a reference, position limit, and a token-bucket message throttle. Benchmark the per-order cost.

**E6 ★★★ Tick-to-trade pipeline.** Chain a UDP feed simulator, decoder, book, a toy strategy (e.g. send an order when the spread narrows), risk checks and an OUCH-like encoder. Timestamp each stage and report a latency histogram for each.

## Interview questions

1. Design an order book: data structures and complexity of add, cancel, modify, execute and best price.
2. How does a matching engine process an aggressive limit order?
3. Price-time vs pro-rata priority?
4. Which modifications lose queue priority, and why?
5. Explain FIX's structure. Why do exchanges use binary protocols for speed?
6. How do you handle gaps in a multicast feed?
7. What is tick-to-trade, and where does the time go?
8. What pre-trade risk checks would you implement, and how do you keep them fast?
9. What is adverse selection?
10. L1 vs L2 vs L3 data?

## Answer key

### Predict

| # | Answer |
| --- | --- |
| P1 | 300 filled at 100.02, 300 at 100.03; asks left: 100.03 × 200; nothing rests. |
| P2 | 300 filled at 100.02; the remaining 300 is cancelled. |
| P3 | A fills 100, B fills 150 (50 left), C nothing. After A increases its size, it loses priority and goes behind B and C. |
| P4 | 0x000F4240 = 1,000,000, so 100.0000. |
| P5 | New order: buy 100 AAPL, limit at 150.25. |
| P6 | Gap of 1001–1002: buffer 1003–1004, request retransmission (or recover from snapshot), and don't apply 1003 until the gap is filled; mark the book stale meanwhile. |

### Spot the bug

- **B1:** Converting to `double` brings rounding into price comparisons and level keys. Keep integer ticks end to end.
- **B2:** Misaligned access and strict aliasing violation (UB), and ITCH is big-endian. Use `memcpy` plus `byteswap`.
- **B3:** Increasing quantity must lose priority (move to the back of the level queue); only decreases keep position.
- **B4:** Stale orders from before the disconnect remain. Clear the book, apply the snapshot, then replay buffered incremental messages after the snapshot's sequence number.
- **B5:** `int32_t` overflows for realistic notional values (UB). Use `int64_t` (or `__int128` for the intermediate) and checked multiplication.
- **B6:** `double` keys suffer from rounding (101.10 may not equal 101.1 computed differently), and a tree is slow. Use integer ticks in a flat or direct-indexed structure.

### Exercise hints

- **E1:** Compute the checksum over every byte up to and including the SOH before `10=`, then compare with the three-digit value.
- **E4:** Keep a FIFO per price level; for FOK, check total available quantity at acceptable prices before executing anything.
- **E5:** Precompute limits per instrument in a flat array indexed by instrument ID; a token bucket needs only a timestamp and a counter.

### Interview questions

1. Pooled orders, an ID-to-order hash map, per-level intrusive FIFO lists with aggregate quantities, and levels in a sorted vector or price-indexed array. Add O(1) at an existing level (O(log n) or amortized O(1) for a new one), cancel O(1), execute O(1) per fill, best price O(1).
2. Walk the opposite side from the best price while the order's limit crosses: fill against resting orders in priority order at their prices, removing filled orders and empty levels; then rest any remainder (unless IOC/FOK).
3. Price-time fills the earliest order at a price first, rewarding speed. Pro-rata splits fills proportionally by size, rewarding size; hybrids give a portion to the first order.
4. Increasing size or changing price, since otherwise a trader could join early with a small order and enlarge it later, jumping ahead of others.
5. Tag=value pairs with SOH delimiters, header (begin string, length, type), body, and checksum trailer. Binary protocols have fixed offsets and widths: no text parsing, no variable lengths, smaller messages.
6. Track sequence numbers per channel, arbitrate A/B lines, buffer messages after a gap, request retransmission or resync from a snapshot, and mark affected instruments stale until recovered.
7. Time from market data packet in to order packet out. NIC and kernel (or bypass) receive, decode, book update, strategy, risk, encode and send; measured with hardware timestamps on a tap.
8. Order size, notional, price collars, position and exposure limits, rate throttles, kill switch, self-trade prevention. Keep state in flat arrays by instrument ID, integer arithmetic, no allocation or locks.
9. Getting filled mostly when the counterparty knows more than you, so trades tend to be followed by adverse price moves.
10. L1: best bid and offer. L2: aggregated quantity per price level. L3: every order individually, enabling queue position estimates.
