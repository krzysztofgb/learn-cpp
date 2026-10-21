:::bug{#B1}
```cpp run=none
void on_fill(const Fill& f) {
    logger.info(std::format("fill {} {} @ {}", f.id, f.qty, f.px));
    update_position(f);
}
```
::answer
`std::format` allocates and formats on the hot path, and the logger may lock or do I/O. Log binary data to a ring buffer and format elsewhere, after updating the position.
:::

:::bug{#B2}
```cpp run=none
for (const auto& q : quotes) std::cout << q.px << std::endl;
```
::answer
`std::endl` flushes on every line, a syscall each time. Use `'\n'` and keep printing off the hot path.
:::

:::bug{#B3}
```cpp run=none
void route(std::shared_ptr<Order> o);   // called per message
```
::answer
Passing `shared_ptr` by value does an atomic increment and decrement per call. Pass `const Order&` or `Order*`.
:::

:::bug{#B4}
```cpp run=none
std::unordered_map<std::string, Book> books;
books[msg.symbol].apply(msg);           // per message
```
::answer
Hashing a string and possibly allocating (`operator[]` inserts) per message. Map symbols to integer IDs once and index an array.
:::

:::bug{#B5}
```cpp run=none
if (!risk.check(order)) throw RejectError(order.id);   // ~2% of orders
```
::answer
A 2% rejection rate is normal flow, not exceptional; each throw costs microseconds. Return a result code.
:::

:::bug{#B6}
```cpp run=none
std::unordered_map<uint64_t, Order*> live_orders;       // grows during the session
```
::answer
The map rehashes when it grows, allocating and moving everything mid-session: a latency spike. `reserve` up front for the expected peak, or use a preallocated open-addressing table.
:::
