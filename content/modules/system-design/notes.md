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
