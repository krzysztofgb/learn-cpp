:::bug{#U1 findings=defined-bug}
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
A defined but fatal bug: while `logic_error` unwinds the stack, `~Flusher` throws a second exception, so `std::terminate` is called. Never throw from destructors.
:::

:::bug{#U2 findings=defined-bug}
```cpp run=none
void Book::add(Order* o) {
    orders_.push_back(o);          // std::vector<Order*>
    by_id_.emplace(o->id, o);      // std::unordered_map<Id, Order*>
}
```
::answer
A defined bug with no exception-safety guarantee: if `emplace` throws (allocation), `orders_` contains a pointer `by_id_` doesn't, breaking the invariant, so not even the basic guarantee holds. Insert into the map first, and roll it back if `push_back` throws, or reserve capacity in advance.
:::

:::bug{#U3 findings=defined-bug}
```cpp run=none
void init() {
    Feed* feed = new Feed;
    Gateway* gw = new Gateway;   // may throw
    run(feed, gw);
    delete gw; delete feed;
}
```
::answer
A leak, which is defined behavior: if `new Gateway` or `run` throws, everything allocated leaks. Use `std::make_unique` for both.
:::

:::bug{#U4 findings=ub}
```cpp run=none
std::expected<Order, Reject> r = validate(msg);
send(*r);
```
::answer
UB if `validate` returned an error: `operator*` doesn't check. Test `if (r)` first, or use `r.value()` to get an exception.
:::

:::bug{#U5 findings=defined-bug}
```cpp run=none
try { risky(); }
catch (const std::exception& e) { log(e.what()); }
catch (const std::runtime_error& e) { recover(); }
```
::answer
A logic bug, not a compile error: the second handler is unreachable because `runtime_error` derives from `exception`, so `recover()` never runs. Order handlers from most to least derived; compilers warn.
:::
