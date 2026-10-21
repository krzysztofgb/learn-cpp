:::bug{#U1}
```cpp
struct Flusher {
    ~Flusher() noexcept(false) { throw std::runtime_error("flush"); }
};
void process() {
    Flusher f;
    throw std::logic_error("bad order");
}
```
::answer
While `logic_error` unwinds the stack, `~Flusher` throws a second exception, so `std::terminate` is called. Never throw from destructors.
:::

:::bug{#U2}
```cpp run=none
void Book::add(Order* o) {
    orders_.push_back(o);          // std::vector<Order*>
    by_id_.emplace(o->id, o);      // std::unordered_map<Id, Order*>
}
```
::answer
Only the basic guarantee at best: if `emplace` throws (allocation), `orders_` contains a pointer `by_id_` doesn't, breaking the invariant. Insert into the map first, and roll it back if `push_back` throws, or reserve capacity in advance.
:::

:::bug{#U3}
```cpp run=none
void init() {
    Feed* feed = new Feed;
    Gateway* gw = new Gateway;   // may throw
    run(feed, gw);
    delete gw; delete feed;
}
```
::answer
If `new Gateway` or `run` throws, everything allocated leaks. Use `std::make_unique` for both.
:::

:::bug{#U4}
```cpp run=none
std::expected<Order, Reject> r = validate(msg);
send(*r);
```
::answer
UB if `validate` returned an error: `operator*` doesn't check. Test `if (r)` first, or use `r.value()` to get an exception.
:::

:::bug{#U5}
```cpp run=none
try { risky(); }
catch (const std::exception& e) { log(e.what()); }
catch (const std::runtime_error& e) { recover(); }
```
::answer
The second handler is unreachable because `runtime_error` derives from `exception`. Order handlers from most to least derived; compilers warn.
:::
