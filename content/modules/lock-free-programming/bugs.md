:::bug{#U1}
```cpp run=none
Node* pop() {
    Node* old = head.load();
    while (old && !head.compare_exchange_weak(old, old->next)) {}
    if (old) delete old;   // freed immediately
    return old;
}
```
::answer
Another thread may have loaded `old` and be reading `old->next` when it's deleted: use-after-free. Also the ABA problem. Use hazard pointers, epochs, or never free nodes (pool with tagged pointers).
:::

:::bug{#U2}
```cpp run=none
bool push(const T& v) {
    auto t = tail_.load(std::memory_order_relaxed);
    if (t - head_.load(std::memory_order_acquire) == N) return false;
    buf_[t & (N - 1)] = v;
    tail_.store(t + 1, std::memory_order_relaxed);
    return true;
}
```
::answer
The relaxed store to `tail_` doesn't publish the slot write, so the consumer can read the slot before the value lands: data race. Use `memory_order_release`.
:::

:::bug{#U3}
```cpp run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
SpscQueue<Order, 1024> q;
std::jthread gw1([&] { while (true) q.push(next_order()); });
std::jthread gw2([&] { while (true) q.push(next_order()); });
```
::answer
Two producers write `tail_` and the same slots concurrently: data race. SPSC means exactly one producer; use an MPMC queue or one SPSC queue per producer.
:::

:::bug{#U4}
```cpp run=none
bool pop(T& out) {
    auto h = head_.load(std::memory_order_relaxed);
    if (h == tail_.load(std::memory_order_acquire)) return false;
    head_.store(h + 1, std::memory_order_release);
    out = buf_[h & (N - 1)];
    return true;
}
```
::answer
The slot is released to the producer before it's read, so the producer can overwrite it while the consumer reads: data race. Read the slot first, then release-store `head_`.
:::
