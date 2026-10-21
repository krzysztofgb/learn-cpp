:::bug{#U1}
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
The timer calls the lambda after the `Strategy` is destroyed: `this` dangles, UB. Cancel the timer in the destructor, or capture a `weak_ptr` and lock it.
:::

:::bug{#U2}
```cpp
auto make_adder(int n) {
    return [&n](int x) { return x + n; };
}
```
::answer
UB on call: `n` is a parameter that dies when `make_adder` returns. Capture by value: `[n]`.
:::

:::bug{#U3}
```cpp run=none
std::string_view label = std::format("{}-{}", venue, symbol);
```
::answer
UB on use: `std::format` returns a temporary `std::string`, which dies at the semicolon. Store a `std::string`.
:::

:::bug{#U4}
```cpp run=none
auto t0 = std::chrono::system_clock::now();
process(order);
auto latency = std::chrono::system_clock::now() - t0;
```
::answer
Not UB, but `system_clock` can jump backward or forward, giving negative or huge latencies. Use `steady_clock`.
:::

:::bug{#U5}
```cpp
std::mt19937 rng(42);
std::uniform_int_distribution<std::uint8_t> byte(0, 255);
auto b = byte(rng);
```
::answer
UB: `uniform_int_distribution` only allows `short`, `int`, `long`, `long long` and their unsigned versions, not character types. Generate an `int` in \[0, 255\] and convert.
:::
