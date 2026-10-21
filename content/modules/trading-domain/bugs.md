:::bug{#B1}
```cpp run=none
double px = read_be<uint32_t>(p + 12) / 10000.0;
book.add(side, px, qty);
```
::answer
Converting to `double` brings rounding into price comparisons and level keys. Keep integer ticks end to end.
:::

:::bug{#B2}
```cpp run=none
auto qty = *reinterpret_cast<const uint32_t*>(msg + 7);
```
::answer
Misaligned access and strict aliasing violation (UB), and ITCH is big-endian. Use `memcpy` plus `byteswap`.
:::

:::bug{#B3}
```cpp run=none
void Book::modify(Order& o, int new_qty) {
    level_of(o).qty += new_qty - o.qty;
    o.qty = new_qty;            // queue position kept for any change
}
```
::answer
Increasing quantity must lose priority (move to the back of the level queue); only decreases keep position.
:::

:::bug{#B4}
On reconnect, the feed handler requests a snapshot and applies it on top of the existing book.
::answer
Stale orders from before the disconnect remain. Clear the book, apply the snapshot, then replay buffered incremental messages after the snapshot's sequence number.
:::

:::bug{#B5}
```cpp run=none
int32_t notional = order.px_ticks * order.qty;
if (notional > limits.max_notional) reject(order);
```
::answer
`int32_t` overflows for realistic notional values (UB). Use `int64_t` (or `__int128` for the intermediate) and checked multiplication.
:::

:::bug{#B6}
```cpp run=none
std::map<double, Level> bids;
```
::answer
`double` keys suffer from rounding (101.10 may not equal 101.1 computed differently), and a tree is slow. Use integer ticks in a flat or direct-indexed structure.
:::
