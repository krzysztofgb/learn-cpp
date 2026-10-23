:::bug{#B1 findings=defined-bug}
```cpp
std::vector<std::vector<double>> matrix(4096, std::vector<double>(4096));
```
::answer
Defined behavior, but slow: 4096 separate heap allocations and an extra indirection per row; rows aren't contiguous with each other. Use one `std::vector<double>` of size n² with index math, or `std::mdspan`.
:::

:::bug{#B2 findings=defined-bug}
```cpp run=none
std::map<int64_t, Order> orders_by_id;   // looked up on every message
```
::answer
Defined behavior, but slow: O(log n) pointer chasing through tree nodes on every message, and allocation on insert. Use an open-addressing hash map or a direct index from order ID to a pool slot.
:::

:::bug{#B3 findings=defined-bug}
```cpp
float grid[64][1024];
for (int c = 0; c < 1024; ++c)
    for (int r = 0; r < 64; ++r) grid[r][c] *= 2;
```
::answer
Defined behavior, but slow: column-order traversal with a 4096-byte stride: every access hits a new line and the same cache sets, causing conflict misses. Swap the loops.
:::

:::bug{#B4 findings=defined-bug}
```cpp
long msgs_per_thread[8];   // thread i increments msgs_per_thread[i]
```
::answer
Defined behavior, but slow: false sharing. Each thread writes its own element, so there is no data race, but all eight counters share one or two cache lines. Pad each to a cache line or keep counters thread-local.
:::

:::bug{#B5 findings=defined-bug}
```cpp run=none
for (auto* h : handlers) h->on_tick(tick);   // 10 handler types, randomly ordered
```
::answer
Defined behavior, but slow: unpredictable indirect calls on every element. Group handlers by type, or use `std::variant`/templates so calls can be inlined.
:::
