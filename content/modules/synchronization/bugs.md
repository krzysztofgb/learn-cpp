:::bug{#U1}
```cpp
long fills = 0;
// 4 threads each run:
for (int i = 0; i < 1'000'000; ++i) ++fills;
```
::answer
Data race on a non-atomic variable: UB. In practice increments are lost. Use `std::atomic<long>` or per-thread counters.
:::

:::bug{#U2}
```cpp run=none
std::unique_lock lk(m);
cv.wait(lk);
process(queue.front());
queue.pop();
```
::answer
Waits without a predicate: a spurious wakeup reaches `queue.front()` on an empty queue (UB), and a notification sent before `wait` is missed forever. Use `cv.wait(lk, [&] { return !queue.empty(); });`.
:::

:::bug{#U3}
```cpp run=none
std::atomic<bool> ready{false};
// producer:
ready = true;
cv.notify_one();
// consumer:
std::unique_lock lk(m);
cv.wait(lk, [&] { return ready.load(); });
```
::answer
Lost wakeup: the consumer can check `ready` (false), then the producer sets it and notifies before the consumer sleeps. Set `ready` while holding `m`.
:::

:::bug{#U4}
```cpp run=none
Widget* g_inst = nullptr;
std::mutex g_m;
Widget* get() {
    if (!g_inst) {
        std::lock_guard lk(g_m);
        if (!g_inst) g_inst = new Widget;
    }
    return g_inst;
}
```
::answer
Data race on `g_inst` (UB), and another thread can see the pointer before the `Widget` is fully constructed. Use a function-local static, or an atomic pointer with acquire/release.
:::

:::bug{#U5}
```cpp run=none
const std::vector<Order>& Book::orders() {
    std::lock_guard lk(m_);
    return orders_;
}
```
::answer
The lock is released on return, so callers read `orders_` unprotected while writers modify it. Return a copy, or take a callback that runs under the lock.
:::

:::bug{#U6}
```cpp run=none
void Account::transfer(Account& to, long amt) {
    std::lock_guard a(m_);
    std::lock_guard b(to.m_);
    balance_ -= amt; to.balance_ += amt;
}
```
::answer
Two transfers in opposite directions can each hold one lock and wait for the other: deadlock. Use `std::scoped_lock lk(m_, to.m_);`, and handle self-transfer (locking the same mutex twice is UB).
:::
