:::predict{#P1}
Asks: 100.02 × 300, 100.03 × 500. A buy limit order for 600 at 100.03 arrives. What fills, at what prices, and what's left on the book?
::choices
- [ ] 600 at 100.03 (the order's limit); asks left: 100.02 × 300
- [ ] 300 at 100.02; the other 300 rests as a bid at 100.03
- [x] 300 at 100.02, 300 at 100.03; asks left: 100.03 × 200
- [ ] 600 at 100.03, all at the limit; asks left: 100.03 × 200
::answer
300 filled at 100.02, 300 at 100.03; asks left: 100.03 × 200; nothing rests.
:::

:::predict{#P2}
Same book; a buy IOC for 600 at 100.02 arrives instead. What happens?
::choices
- [ ] Nothing fills: IOC needs the full 600 at once
- [x] 300 at 100.02; the other 300 is cancelled
- [ ] 300 at 100.02; the other 300 rests at 100.02
- [ ] 300 at 100.02 and 300 at 100.03
::answer
300 filled at 100.02; the remaining 300 is cancelled.
:::

:::predict{#P3}
Bids at 100.00 in time order: A 100, B 200, C 50. A market sell for 250 arrives. Who fills how much? Then A increases its order to 150. Where does A stand in the queue?
::choices
- [ ] A 100, B 150, C 0; A keeps its place at the front
- [ ] A 71, B 143, C 36 (pro rata); A keeps its place
- [ ] A 100, B 150, C 0; A moves behind B but ahead of C
- [x] A 100, B 150, C 0; A moves behind B and C
::answer
A fills 100, B fills 150 (50 left), C nothing. After A increases its size, it loses priority and goes behind B and C.
:::

:::predict{#P4}
An ITCH price field contains the big-endian bytes `00 0F 42 40`. What price is that?
::choices
- [ ] 10000.00
- [ ] 107807.1040
- [x] 100.0000
- [ ] 1000000
::answer
0x000F4240 = 1,000,000; ITCH prices carry four implied decimals, so 100.0000.
:::

:::predict{#P5}
Decode: `35=D|55=AAPL|54=1|38=100|40=2|44=150.25|`.
::choices
- [ ] New order: sell 100 AAPL, limit at 150.25
- [x] New order: buy 100 AAPL, limit at 150.25
- [ ] New order: buy 100 AAPL at market (150.25 is a reference price)
- [ ] Cancel the earlier buy of 100 AAPL at 150.25
::answer
New order: buy 100 AAPL, limit at 150.25.
:::

:::predict{#P6}
The last applied sequence number is 1000. The next packet has sequence 1003 and holds two messages. What do you do?
::choices
- [ ] Apply 1003–1004 now, then request 1001–1002 to patch the book
- [ ] Discard 1003–1004 and wait for 1001 to arrive on the feed
- [ ] Skip ahead: small UDP gaps are normal, keep applying from 1003
- [x] Buffer 1003–1004, recover 1001–1002, keep the book stale until then
::answer
Gap of 1001–1002: buffer 1003–1004, request retransmission (or recover from snapshot), and don't apply 1003 until the gap is filled; mark the book stale meanwhile.
:::
