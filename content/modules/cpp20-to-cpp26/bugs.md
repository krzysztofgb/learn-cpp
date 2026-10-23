:::bug{#U1 findings=ub}
```cpp run=none
Task<void> handle(const std::string& msg) {
    co_await network.send(encode(msg));
    log(msg);
}
// called as: handle(build_message());
```
::answer
UB: the temporary `std::string` dies when `handle(...)` returns at the first suspension, so `log(msg)` reads a dangling reference. Take `std::string` by value in coroutines.
:::

:::bug{#U2 findings=ub}
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

:::bug{#U3 findings=ub}
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
UB: `std::unreachable()` is reached for a value that names no enumerator (`'X'` is still a valid `Side`, since the underlying type is fixed, so the cast itself is fine). Validate input from the wire before converting to the enum.
:::

:::bug{#U4 findings=compile-error}
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

:::bug{#U5 findings=unspecified}
```cpp run=none
int validated = 0;
void submit(const Order& o) pre(++validated > 0);
```
::answer
Unspecified behavior: contract predicates may be evaluated zero, one, or more times depending on the semantic, so the side effect makes `validated` unpredictable. \[basic.contract.eval\] lets an implementation re-evaluate assertions within a sequence (its Example 3 lists #1 #1 #2 #2 as a valid evaluation order) and skips the predicate entirely under the ignore semantic. Keep predicates side-effect free.
:::
