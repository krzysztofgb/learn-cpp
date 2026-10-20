# Module 29: System design for quant dev

Trading system design rounds differ from web-scale ones: the priorities are microseconds, determinism, correctness under failure, and recovery, not horizontal scaling. Your distributed-systems background (Kafka, Postgres, payments) is a real asset for the replay, recovery and audit parts; the new part is the single-box, nanosecond-budget thinking.

## How to run a design answer

1. **Clarify** (3–5 min): asset class and venues, message rates (average and burst), latency target, what's in and out of scope, failure expectations.
2. **Sketch the data flow** end to end, naming threads and the queues between them.
3. **Set a latency budget** per stage and say what dominates.
4. **Choose data structures** for the hot path and justify them (Modules 11, 19, 22).
5. **Cover failure and recovery:** gaps, disconnects, restarts, duplicate messages, clock issues.
6. **Say how you'd measure and test it** (Module 23), including deterministic replay.

### What interviewers score

| Area | Strong answer | Weak answer |
| --- | --- | --- |
| Hot path | Single-threaded per instrument or partition, no locks, no allocation, pinned cores | Thread pools, shared mutable state, mutexes per order |
| Data flow | Clear thread boundaries with SPSC queues | Everything talks to everything |
| Correctness | Sequence numbers, idempotency, invariants, reconciliation | "TCP is reliable" |
| Recovery | Snapshot + replay, journaled state, defined startup procedure | Restart and hope |
| Measurement | Hardware timestamps, histograms per stage, replay benchmarks | Average latency from logs |
| Trade-offs | States what was sacrificed and why | One option presented as obviously right |

## Prompt 1: Market data feed handler

"Design a system that consumes a multicast feed for 8,000 US equities and provides order books to several strategies on the same machine."

**Clarifying questions:** L2 or L3? Peak message rate (millions per second at the open)? How many consumers, same process or separate processes? Latency target?

## Prompt 2: Order gateway

"Design the component that takes orders from strategies and sends them to an exchange, and routes exchange responses back."

**Clarifying questions:** one venue or many? Protocol (FIX, OUCH, SBE)? Multiple strategies sharing a session? Throttle limits? Required audit trail?

## Prompt 3: Pre-trade risk system

"Design pre-trade risk checks that every order must pass, plus the firm-wide limits behind them."

**Clarifying questions:** which limits (order size, notional, position, loss)? Per strategy, account or firm? Who updates limits, and how fast must changes take effect? Kill switch requirements?

## Prompt 4: Low-latency logging and telemetry

"Strategies need detailed logs and latency metrics without slowing down the hot path. Design it."

**Clarifying questions:** volume (events per second)? Must logs survive a crash? Who consumes metrics, in real time or after the fact?

## Prompt 5: Backtesting and replay

"Design infrastructure to replay historical market data through production strategy code to evaluate changes."

**Clarifying questions:** same binary as production? Data volume (TB per day)? Need for exchange simulation (fills, queue position)? Determinism requirements? Parallelism across days or instruments?

## Exercises

**E1 ★★ Timed whiteboard.** Pick a prompt, set a 35-minute timer, and talk through it aloud (record yourself). Then compare against the model outline and the rubric.

**E2 ★★ Latency budget.** For Prompt 1, write a stage-by-stage budget totaling 5 µs from packet arrival to strategy callback, and justify each number with measurements from earlier modules.

**E3 ★★★ Build a slice.** Implement a minimal version of Prompt 1 end to end using your Module 25 multicast simulator, Module 26 decoder and book, and Module 19 SPSC queues, with per-stage histograms.

**E4 ★★ Failure drill.** For Prompt 2, list ten failure scenarios (exchange disconnect mid-order, duplicate ack, out-of-order fills, gateway crash after sending but before journaling, and so on) and the exact handling for each.

## Answer key: model outlines

### Prompt 1: Feed handler

- **Ingest:** kernel bypass NIC (or tuned sockets with busy polling), one receive thread per feed line pair, pinned to an isolated core on the NIC's NUMA node.
- **Arbitration:** take the first copy of each sequence number from lines A and B; detect gaps; buffer out-of-order packets briefly; request retransmission or recover from snapshot; mark affected instruments stale until consistent.
- **Decode and book build:** decode in place (`memcpy` field reads, integer prices); partition instruments across book-builder threads by symbol hash so each book has a single writer. Books use pooled orders, intrusive per-level lists, and array or sorted-vector levels (Module 22).
- **Distribution:** same process: strategies run on the book thread via callbacks (lowest latency) or receive updates over SPSC queues. Separate processes: shared memory with a seqlock per book's top levels, or per-consumer SPSC rings of updates.
- **Latency budget (example):** NIC to user space 1 µs (bypass), arbitration 50 ns, decode 50–100 ns, book update 100–200 ns, publish 100 ns.
- **Recovery:** on startup or after a gap, load a snapshot, then apply buffered incremental messages with sequence numbers after it.
- **Testing:** record raw packets (pcap) and replay them deterministically; verify books against the exchange's own snapshots or end-of-day state.

### Prompt 2: Order gateway

- **Inbound from strategies:** each strategy thread has an SPSC queue to the gateway (no shared locks), or the gateway logic runs inline on the strategy thread for the lowest latency, with one session per strategy.
- **Order state machine:** pending new → acknowledged → partially filled → filled, plus pending cancel, cancelled, rejected; client order IDs map to exchange IDs; unexpected transitions raise alerts.
- **Risk:** pre-trade checks inline before encoding (Prompt 3).
- **Encoding and session:** protocol encoder writing into preallocated buffers; session layer handles logon, heartbeats, sequence numbers, resend requests, and exchange throttles (token bucket per session).
- **Responses:** decode execution reports, update order state and positions, route to the owning strategy's queue.
- **Durability:** journal every outbound and inbound message (sequence-numbered, append-only, written by a separate thread from an SPSC ring) for audit and for recovering state after a crash. On restart, replay the journal, then reconcile with the exchange (order status requests, drop-copy) before trading.
- **Failure handling:** on disconnect, the exchange may cancel-on-disconnect; otherwise orders are in an unknown state until reconciled, so block new orders for affected instruments. Duplicate fills are detected by exchange execution ID.

### Prompt 3: Pre-trade risk

- **Two tiers:** fast, local, synchronous checks on every order (in the gateway path, O(1), no locks): max quantity, max notional, price collar against a reference price, per-instrument position limit, order rate throttle, and a kill-switch flag. Slower, centralized checks run asynchronously: firm-wide exposure, P&L drawdown, aggregated across machines.
- **Data layout:** limits and positions in flat arrays indexed by instrument ID; limits updated through an RCU-style swap of an immutable limits table (readers never block) or a seqlock.
- **Positions:** updated from fills on the hot path; the central system reconciles with drop-copy feeds from exchanges and brokers.
- **Limit updates:** the central system pushes new tables; the hot path picks them up on the next order. The kill switch must take effect within microseconds locally and be triggerable remotely.
- **Failure posture:** fail closed. If risk state is stale or unknown, block orders.

### Prompt 4: Logging and telemetry

- **Hot path:** write fixed-size binary records (timestamp from `rdtsc` or equivalent, event ID, raw arguments) into a per-thread SPSC ring. No formatting, no syscalls, no allocation. If the ring is full, drop and count (never block the strategy).
- **Background thread:** drains rings, converts timestamps, formats or writes binary files, ships to storage; latency stats aggregated into HDR histograms per stage and published periodically.
- **Crash survival:** put rings in a shared-memory or memory-mapped file so a separate process can recover the tail after a crash.
- **Consumers:** real-time dashboards from histograms; offline analysis from binary logs decoded with the same schema.

### Prompt 5: Backtesting and replay

- **Same code:** strategies are written against interfaces (market data in, orders out, a clock) so the production binary or library runs unchanged with simulated implementations.
- **Data:** raw packet captures or normalized event logs per day and venue, stored in columnar or compressed binary files; replay reads sequentially at memory speed.
- **Time:** a simulated clock driven by event timestamps; no wall-clock calls in strategy code, which is what makes runs deterministic.
- **Exchange simulation:** a matching engine model with queue position estimation and configurable latency for order round trips; fill realism is the hardest and most debated part.
- **Parallelism:** independent days or instruments run in parallel across machines (embarrassingly parallel); results aggregated into P&L, fill and latency reports.
- **Determinism checks:** identical inputs must produce bit-identical outputs; diff runs before and after a change to attribute differences.

### Common follow-ups and short answers

- **"How do you scale to more instruments?"** Partition by instrument across cores and machines, each partition single-writer.
- **"What if a strategy is slow?"** Its queue fills; drop or conflate updates for that consumer (keep latest book state) rather than slowing the feed handler.
- **"Why not use Kafka?"** Milliseconds of latency and broker hops; fine for post-trade, analytics and audit pipelines, not the trading path.
- **"How do you deploy safely?"** Replay validation, shadow mode (compute decisions without sending), gradual enablement per instrument, kill switches.
