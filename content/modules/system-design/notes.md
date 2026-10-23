## How to run a design answer

1. **Clarify** (3–5 min): asset class and venues, message rates (average and burst), latency target, what's in and out of scope, failure expectations.
2. **Sketch the data flow** end to end, naming threads and the queues between them.
3. **Set a latency budget** per stage and say what dominates.
4. **Choose data structures** for the hot path and justify them (Modules :mod[containers]{bare}, :mod[lock-free-programming]{bare}, :mod[low-latency-techniques]{bare}).
5. **Cover failure and recovery:** gaps, disconnects, restarts, duplicate messages, clock issues.
6. **Say how you'd measure and test it** (:mod[measurement]), including deterministic replay.

### What interviewers score

| Area | Strong answer | Weak answer |
| --- | --- | --- |
| Hot path | Single-threaded per instrument or partition, no locks, no allocation, pinned cores | Thread pools, shared mutable state, mutexes per order |
| Data flow | Clear thread boundaries with SPSC queues | Everything talks to everything |
| Correctness | Sequence numbers, idempotency, invariants, reconciliation | "TCP is reliable" |
| Recovery | Snapshot + replay, journaled state, defined startup procedure | Restart and hope |
| Measurement | Hardware timestamps, histograms per stage, replay benchmarks | Average latency from logs |
| Trade-offs | States what was sacrificed and why | One option presented as obviously right |

### Building blocks

The model answers combine a small set of parts. Know what each one is and where it's taught.

- **Kernel bypass and busy polling:** the receive thread reads the NIC's rings from user space and spins instead of sleeping in the kernel (:sec[networking/kernel-bypass-and-timestamps]).
- **Pinned, isolated cores:** each hot thread owns a core that the scheduler and interrupts leave alone, on the same NUMA node as the NIC and its memory (:sec[low-latency-techniques/the-machine], :sec[hardware/cores-coherence-and-numa]).
- **Single writer per partition:** split instruments across threads (by symbol hash or ID range) so each book or position has exactly one writing thread and needs no locks; scale by adding partitions.
- **SPSC queues between threads:** a bounded ring with one producer and one consumer is the cheapest thread-to-thread hand-off (:sec[lock-free-programming/spsc-ring-buffer]). When a consumer falls behind, the producer must not block: drop and count, or *conflate* (keep only the latest state per instrument, so a slow reader skips intermediate updates).
- **Seqlock and RCU-style swap:** ways to let many readers see data that one writer updates without ever blocking: a seqlock for small, frequently changing records such as top of book; publishing a pointer to a new immutable copy for rarely changing tables such as risk limits (:sec[lock-free-programming/other-structures], :sec[lock-free-programming/memory-reclamation]).
- **Sequence numbers, arbitration and snapshot recovery:** how a feed handler detects loss and rebuilds state (:sec[trading-domain/feed-handling]).
- **Order state machine:** every order moves through explicit states (pending new, acknowledged, partially filled, filled, pending cancel, cancelled, rejected). Messages that don't fit the current state (a fill for an unknown order, a duplicate ack) are detected rather than applied blindly.
- **Idempotency:** applying the same message twice must not change state twice. Exchanges give each execution a unique execution ID, so a duplicate fill is recognized and ignored.
- **Journaling:** an append-only, sequence-numbered log of every message in and out, written off the hot path from a ring. Replaying it rebuilds state after a crash; whatever could have happened after the last journaled record (an order sent but not yet logged) has to be resolved by asking the exchange.
- **Reconciliation:** comparing your state with an independent source of truth: order status requests to the exchange, and *drop copy*, a separate feed from the exchange or broker that copies every execution on your account.
- **Cancel on disconnect:** a session option under which the exchange cancels all of a session's resting orders if the connection drops. Without it, orders keep working while you can't see them.
- **Fail closed:** when state is unknown or stale (risk data, positions, a disconnected session), stop sending orders rather than guess.
- **Deterministic replay:** strategy code takes time and events from interfaces, so recorded input fed through a simulated clock reproduces a run bit for bit; the basis for testing, benchmarking and backtesting.
- **Measurement:** hardware timestamps at the wire for end-to-end latency, cheap per-stage timestamps inside the process, and latency histograms rather than averages (:sec[measurement/histograms], :sec[measurement/clocks-and-timers], :sec[measurement/production]).

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
