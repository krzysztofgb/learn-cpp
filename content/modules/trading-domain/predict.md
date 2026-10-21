:::predict{#P1}
Asks: 100.02 × 300, 100.03 × 500. A buy limit order for 600 at 100.03 arrives. What fills, at what prices, and what's left on the book?
::answer
300 filled at 100.02, 300 at 100.03; asks left: 100.03 × 200; nothing rests.
:::

:::predict{#P2}
Same book; a buy IOC for 600 at 100.02 arrives instead. What happens?
::answer
300 filled at 100.02; the remaining 300 is cancelled.
:::

:::predict{#P3}
Bids at 100.00 in time order: A 100, B 200, C 50. A market sell for 250 arrives. Who fills how much? Then A increases its order to 150. Where does A stand in the queue?
::answer
A fills 100, B fills 150 (50 left), C nothing. After A increases its size, it loses priority and goes behind B and C.
:::

:::predict{#P4}
An ITCH price field contains the big-endian bytes `00 0F 42 40`. What price is that?
::answer
0x000F4240 = 1,000,000, so 100.0000.
:::

:::predict{#P5}
Decode: `35=D|55=AAPL|54=1|38=100|40=2|44=150.25|`.
::answer
New order: buy 100 AAPL, limit at 150.25.
:::

:::predict{#P6}
The last applied sequence number is 1000. The next packet has sequence 1003 and holds two messages. What do you do?
::answer
Gap of 1001–1002: buffer 1003–1004, request retransmission (or recover from snapshot), and don't apply 1003 until the gap is filled; mark the book stale meanwhile.
:::
