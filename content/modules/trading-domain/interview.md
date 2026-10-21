:::question{#Q1}
Design an order book: data structures and complexity of add, cancel, modify, execute and best price.
::answer
Pooled orders, an ID-to-order hash map, per-level intrusive FIFO lists with aggregate quantities, and levels in a sorted vector or price-indexed array. Add O(1) at an existing level (O(log n) or amortized O(1) for a new one), cancel O(1), execute O(1) per fill, best price O(1).
:::

:::question{#Q2}
How does a matching engine process an aggressive limit order?
::answer
Walk the opposite side from the best price while the order's limit crosses: fill against resting orders in priority order at their prices, removing filled orders and empty levels; then rest any remainder (unless IOC/FOK).
:::

:::question{#Q3}
Price-time vs pro-rata priority?
::answer
Price-time fills the earliest order at a price first, rewarding speed. Pro-rata splits fills proportionally by size, rewarding size; hybrids give a portion to the first order.
:::

:::question{#Q4}
Which modifications lose queue priority, and why?
::answer
Increasing size or changing price, since otherwise a trader could join early with a small order and enlarge it later, jumping ahead of others.
:::

:::question{#Q5}
Explain FIX's structure. Why do exchanges use binary protocols for speed?
::answer
Tag=value pairs with SOH delimiters, header (begin string, length, type), body, and checksum trailer. Binary protocols have fixed offsets and widths: no text parsing, no variable lengths, smaller messages.
:::

:::question{#Q6}
How do you handle gaps in a multicast feed?
::answer
Track sequence numbers per channel, arbitrate A/B lines, buffer messages after a gap, request retransmission or resync from a snapshot, and mark affected instruments stale until recovered.
:::

:::question{#Q7}
What is tick-to-trade, and where does the time go?
::answer
Time from market data packet in to order packet out. NIC and kernel (or bypass) receive, decode, book update, strategy, risk, encode and send; measured with hardware timestamps on a tap.
:::

:::question{#Q8}
What pre-trade risk checks would you implement, and how do you keep them fast?
::answer
Order size, notional, price collars, position and exposure limits, rate throttles, kill switch, self-trade prevention. Keep state in flat arrays by instrument ID, integer arithmetic, no allocation or locks.
:::

:::question{#Q9}
What is adverse selection?
::answer
Getting filled mostly when the counterparty knows more than you, so trades tend to be followed by adverse price moves.
:::

:::question{#Q10}
L1 vs L2 vs L3 data?
::answer
L1: best bid and offer. L2: aggregated quantity per price level. L3: every order individually, enabling queue position estimates.
:::
