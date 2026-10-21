### Orders and the book

- **Order types:** limit (a price, may rest on the book), market (take whatever is available), stop (becomes active at a trigger price), plus flags such as post-only (cancel rather than take liquidity) and iceberg (show only part of the size).
- **Time in force:** DAY, GTC (good till cancelled), IOC (fill what you can immediately, cancel the rest), FOK (fill completely immediately or cancel entirely).
- **The book:** bids sorted by price descending, asks ascending. The best bid and best offer (BBO) form the top of book; the spread is ask minus bid. Prices move in ticks (the minimum increment); quantities in lots.
- **Data levels:** L1 = top of book; L2 = aggregated quantity per price level (market by price); L3 = every individual order (market by order).

### Matching

An incoming order that crosses the spread matches against the opposite side, best price first. Among orders at the same price, most equity venues use **price-time priority** (FIFO); some futures markets use **pro-rata** allocation (proportional to size) or hybrids. Fills happen at the resting order's price. Whatever remains of a limit order rests on the book (unless IOC or FOK).

Modifies matter for priority: reducing quantity usually keeps queue position; increasing quantity or changing price loses it (treated as cancel and replace).

### Protocols

- **FIX:** tag=value ASCII separated by SOH (0x01), e.g. `8=FIX.4.4|9=...|35=D|...|10=123|`. Common tags: 35 MsgType (D = NewOrderSingle, 8 = ExecutionReport, F = cancel request), 55 Symbol, 54 Side (1 buy, 2 sell), 38 OrderQty, 44 Price, 40 OrdType (1 market, 2 limit), 11 ClOrdID. Tag 9 is body length; tag 10 is a checksum (sum of all preceding bytes mod 256, as three digits). The session layer handles logon, heartbeats, sequence numbers and resend requests. Flexible but slow to parse.
- **SBE (Simple Binary Encoding):** fixed-layout little-endian binary messages with schema-defined templates, used by CME's market data (MDP 3.0) and order entry (iLink 3). Fields decode with fixed offsets.
- **NASDAQ ITCH 5.0:** binary, big-endian market-by-order feed. Message types include `A` add order, `F` add with attribution, `E` executed, `C` executed with price, `X` partial cancel, `D` delete, `U` replace and `P` trade. Prices are 4-byte integers with 4 implied decimals; timestamps are 6-byte nanoseconds since midnight. Delivered over MoldUDP64 (sequenced multicast) with a retransmission server.
- **OUCH:** NASDAQ's binary order entry protocol, over SoupBinTCP.

### Feed handling

A feed handler receives packets (A and B lines), arbitrates and orders messages by sequence number, detects gaps, recovers (retransmission request or snapshot plus replay), decodes messages, and updates books. Until a gap is recovered, an order-by-order book can't be trusted; the handler marks the instrument stale.

### Tick-to-trade

The time from a market data packet arriving at the NIC to the resulting order packet leaving. Components: NIC to user space, decode, book update, strategy decision, pre-trade risk, order encoding, send. Competitive software systems target single-digit microseconds or less; FPGA systems, tens to hundreds of nanoseconds.

### Pre-trade risk

Every order must pass checks before it reaches the exchange (in the US, SEC Rule 15c3-5 requires brokers to have them): maximum order size and notional, price collars against a reference price (fat-finger protection), position and exposure limits, message rate throttles, and a kill switch. They sit on the critical path, so they must be O(1) with no allocation.

### Strategy vocabulary

Market makers quote both sides and earn the spread while managing inventory risk; their main danger is *adverse selection* (being filled by better-informed traders right before the price moves against them). Speed matters for updating or cancelling quotes before being picked off, and for taking stale quotes. Colocation puts servers in the exchange's data center: CME in Aurora, Illinois; NYSE in Mahwah, NJ; NASDAQ in Carteret, NJ.
