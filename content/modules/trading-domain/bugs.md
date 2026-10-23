:::bug{#B1 findings=defined-bug}
```cpp run=none
double px = read_be<uint32_t>(p + 12) / 10000.0;
book.add(side, px, qty);
```
::answer
A defined but real bug: converting to `double` brings rounding into price comparisons and level keys. Keep integer ticks end to end.
:::

:::bug{#B2 findings=ub,defined-bug}
```cpp run=none
auto qty = *reinterpret_cast<const uint32_t*>(msg + 7);
```
::answer
UB, plus a defined bug: the misaligned access and strict aliasing violation are UB, and even where the load works it reads ITCH's big-endian bytes in host order on a little-endian machine, giving the wrong quantity. Use `memcpy` plus `std::byteswap`.
:::

:::bug{#B3 findings=defined-bug}
```cpp run=none
void Book::modify(Order& o, int new_qty) {
    level_of(o).qty += new_qty - o.qty;
    o.qty = new_qty;            // queue position kept for any change
}
```
::answer
A defined logic bug: increasing quantity must lose priority (move to the back of the level queue); only decreases keep position.
:::

:::bug{#B4 findings=defined-bug}
On reconnect, the feed handler requests a snapshot and applies it on top of the existing book.
::answer
A defined logic bug: stale orders from before the disconnect remain. Clear the book, apply the snapshot, then replay buffered incremental messages after the snapshot's sequence number.
:::

:::bug{#B5 findings=ub}
```cpp run=none
int32_t notional = order.px_ticks * order.qty;
if (notional > limits.max_notional) reject(order);
```
::answer
UB: with 32-bit operands the multiplication overflows `int32_t` for realistic notional values, and signed overflow is undefined. Use `int64_t` (or `__int128` for the intermediate) and checked multiplication.
:::

:::bug{#B6 findings=defined-bug}
```cpp run=none
std::map<double, Level> bids;
```
::answer
A defined but real bug: `double` keys suffer from rounding (101.10 may not equal 101.1 computed differently), and a tree is slow. Use integer ticks in a flat or direct-indexed structure.
:::
