:::bug{#U1 findings=ub}
```cpp run=none
class Strategy {
    Timer& timer_;
public:
    void start() { timer_.every(1ms, [this] { on_tick(); }); }
    void on_tick();
};
// a Strategy is destroyed while its timer keeps running
```
::answer
UB: the timer calls the lambda after the `Strategy` is destroyed, so `this` dangles. Cancel the timer in the destructor, or capture a `weak_ptr` and lock it.
:::

:::bug{#U2 findings=ub}
```cpp
auto make_adder(int n) {
    return [&n](int x) { return x + n; };
}
```
::answer
UB on call: `n` is a parameter that dies when `make_adder` returns. Capture by value: `[n]`.
:::

:::bug{#U3 findings=ub}
```cpp run=none
std::string_view label = std::format("{}-{}", venue, symbol);
```
::answer
UB on use: `std::format` returns a temporary `std::string`, which dies at the semicolon. Store a `std::string`.
:::

:::bug{#U4 findings=defined-bug}
```cpp run=none
auto t0 = std::chrono::system_clock::now();
process(order);
auto latency = std::chrono::system_clock::now() - t0;
```
::answer
A defined bug, not UB: `system_clock` can jump backward or forward, giving negative or huge latencies. Use `steady_clock`.
:::

:::bug{#U5 findings=ub}
```cpp
std::mt19937 rng(42);
std::uniform_int_distribution<std::uint8_t> byte(0, 255);
auto b = byte(rng);
```
::answer
UB: `uniform_int_distribution` only allows `short`, `int`, `long`, `long long` and their unsigned versions, not character types. Generate an `int` in \[0, 255\] and convert.
:::
