:::bug{#U1}
```cpp run=none
Task<void> handle(const std::string& msg) {
    co_await network.send(encode(msg));
    log(msg);
}
// called as: handle(build_message());
```
::answer
The temporary `std::string` dies when `handle(...)` returns at the first suspension, so `log(msg)` reads a dangling reference. Take `std::string` by value in coroutines.
:::

:::bug{#U2}
```cpp
int scale(int x) {
    [[assume(x > 0)]];
    return 100 / x;
}
scale(0);
```
::answer
UB: the assumption is false when `x` is 0, so the optimizer may have removed checks based on it. `[[assume]]` is a promise, not an assertion.
:::

:::bug{#U3}
```cpp
enum class Side : char { Buy = 'B', Sell = 'S' };
const char* name(Side s) {
    switch (s) {
        case Side::Buy: return "buy";
        case Side::Sell: return "sell";
    }
    std::unreachable();
}
name(static_cast<Side>('X'));
```
::answer
UB: `std::unreachable()` is reached for an out-of-range enum value. Validate input from the wire before converting to the enum.
:::

:::bug{#U4}
```cpp
struct Quote {
    double bid, ask;
    std::mutex m;
    auto operator<=>(const Quote&) const = default;
};
Quote a, b;
bool less = a < b;
```
::answer
Doesn't compile: `std::mutex` has no `<=>`, so the defaulted operator is deleted.
:::

:::bug{#U5}
```cpp run=none
int validated = 0;
void submit(const Order& o) pre(++validated > 0);
```
::answer
Contract predicates may be evaluated zero, one, or more times depending on the semantic, so side effects make behavior unpredictable. \[basic.contract.eval\] lets an implementation re-evaluate assertions within a sequence (its Example 3 lists #1 #1 #2 #2 as a valid evaluation order) and skips the predicate entirely under the ignore semantic. Predicates must be side-effect free.
:::
