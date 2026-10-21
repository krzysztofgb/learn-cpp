## Prompt 1: Feed handler

- **Ingest:** kernel bypass NIC (or tuned sockets with busy polling), one receive thread per feed line pair, pinned to an isolated core on the NIC's NUMA node.
- **Arbitration:** take the first copy of each sequence number from lines A and B; detect gaps; buffer out-of-order packets briefly; request retransmission or recover from snapshot; mark affected instruments stale until consistent.
- **Decode and book build:** decode in place (`memcpy` field reads, integer prices); partition instruments across book-builder threads by symbol hash so each book has a single writer. Books use pooled orders, intrusive per-level lists, and array or sorted-vector levels (:mod[low-latency-techniques]).
- **Distribution:** same process: strategies run on the book thread via callbacks (lowest latency) or receive updates over SPSC queues. Separate processes: shared memory with a seqlock per book's top levels, or per-consumer SPSC rings of updates.
- **Latency budget (example):** NIC to user space 1 µs (bypass), arbitration 50 ns, decode 50–100 ns, book update 100–200 ns, publish 100 ns.
- **Recovery:** on startup or after a gap, load a snapshot, then apply buffered incremental messages with sequence numbers after it.
- **Testing:** record raw packets (pcap) and replay them deterministically; verify books against the exchange's own snapshots or end-of-day state.

## Prompt 2: Order gateway

- **Inbound from strategies:** each strategy thread has an SPSC queue to the gateway (no shared locks), or the gateway logic runs inline on the strategy thread for the lowest latency, with one session per strategy.
- **Order state machine:** pending new → acknowledged → partially filled → filled, plus pending cancel, cancelled, rejected; client order IDs map to exchange IDs; unexpected transitions raise alerts.
- **Risk:** pre-trade checks inline before encoding (Prompt 3).
- **Encoding and session:** protocol encoder writing into preallocated buffers; session layer handles logon, heartbeats, sequence numbers, resend requests, and exchange throttles (token bucket per session).
- **Responses:** decode execution reports, update order state and positions, route to the owning strategy's queue.
- **Durability:** journal every outbound and inbound message (sequence-numbered, append-only, written by a separate thread from an SPSC ring) for audit and for recovering state after a crash. On restart, replay the journal, then reconcile with the exchange (order status requests, drop-copy) before trading.
- **Failure handling:** on disconnect, the exchange may cancel-on-disconnect; otherwise orders are in an unknown state until reconciled, so block new orders for affected instruments. Duplicate fills are detected by exchange execution ID.

## Prompt 3: Pre-trade risk

- **Two tiers:** fast, local, synchronous checks on every order (in the gateway path, O(1), no locks): max quantity, max notional, price collar against a reference price, per-instrument position limit, order rate throttle, and a kill-switch flag. Slower, centralized checks run asynchronously: firm-wide exposure, P&L drawdown, aggregated across machines.
- **Data layout:** limits and positions in flat arrays indexed by instrument ID; limits updated through an RCU-style swap of an immutable limits table (readers never block) or a seqlock.
- **Positions:** updated from fills on the hot path; the central system reconciles with drop-copy feeds from exchanges and brokers.
- **Limit updates:** the central system pushes new tables; the hot path picks them up on the next order. The kill switch must take effect within microseconds locally and be triggerable remotely.
- **Failure posture:** fail closed. If risk state is stale or unknown, block orders.

## Prompt 4: Logging and telemetry

- **Hot path:** write fixed-size binary records (timestamp from `rdtsc` or equivalent, event ID, raw arguments) into a per-thread SPSC ring. No formatting, no syscalls, no allocation. If the ring is full, drop and count (never block the strategy).
- **Background thread:** drains rings, converts timestamps, formats or writes binary files, ships to storage; latency stats aggregated into HDR histograms per stage and published periodically.
- **Crash survival:** put rings in a shared-memory or memory-mapped file so a separate process can recover the tail after a crash.
- **Consumers:** real-time dashboards from histograms; offline analysis from binary logs decoded with the same schema.

## Prompt 5: Backtesting and replay

- **Same code:** strategies are written against interfaces (market data in, orders out, a clock) so the production binary or library runs unchanged with simulated implementations.
- **Data:** raw packet captures or normalized event logs per day and venue, stored in columnar or compressed binary files; replay reads sequentially at memory speed.
- **Time:** a simulated clock driven by event timestamps; no wall-clock calls in strategy code, which is what makes runs deterministic.
- **Exchange simulation:** a matching engine model with queue position estimation and configurable latency for order round trips; fill realism is the hardest and most debated part.
- **Parallelism:** independent days or instruments run in parallel across machines (embarrassingly parallel); results aggregated into P&L, fill and latency reports.
- **Determinism checks:** identical inputs must produce bit-identical outputs; diff runs before and after a change to attribute differences.

## Common follow-ups and short answers

- **"How do you scale to more instruments?"** Partition by instrument across cores and machines, each partition single-writer.
- **"What if a strategy is slow?"** Its queue fills; drop or conflate updates for that consumer (keep latest book state) rather than slowing the feed handler.
- **"Why not use Kafka?"** Milliseconds of latency and broker hops; fine for post-trade, analytics and audit pipelines, not the trading path.
- **"How do you deploy safely?"** Replay validation, shadow mode (compute decisions without sending), gradual enablement per instrument, kill switches.
