:::bug{#U1 findings=ub}
```cpp
std::string a = "abc";
const std::string& m = std::max(a, std::string("zzz"));
std::cout << m;
```
::answer
UB: `std::max` returns a reference to its larger argument, the temporary. The temporary dies at the semicolon, so `m` dangles. Store the result by value.
:::

:::bug{#U2 findings=ub}
```cpp
std::function<int()> make_counter() {
    int count = 0;
    return [&] { return ++count; };
}
```
::answer
UB as soon as the returned lambda is called: it captures the local `count` by reference and outlives it. Capture by value with `mutable`: `[count = 0]() mutable { return ++count; }`.
:::

:::bug{#U3 findings=ub}
```cpp run=none
// prefix.cpp
std::string g_prefix = "MD:";
// topic.cpp
extern std::string g_prefix;
std::string g_topic = g_prefix + "AAPL";
```
::answer
UB if `topic.cpp`'s initializer runs first: it calls `operator+` on an unconstructed string. It depends on link order.
:::

:::bug{#U4 findings=ub}
```cpp run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
void start(const Config& cfg) {
    std::thread t([&] { run(cfg); });
    t.detach();
}
// called as: start(Config{...});
```
::answer
UB: the temporary `Config` dies when `start`'s caller finishes its full expression, while the detached thread still reads it. Copy it into the lambda: `[cfg] { run(cfg); }`.
:::

:::bug{#U5 findings=defined-bug}
```cpp
struct Conn {
    ~Conn() { if (!flush()) throw std::runtime_error("flush failed"); }
    bool flush();
};
```
::answer
A defined bug, not UB: the throw calls `std::terminate`, because destructors are `noexcept`. Provide an explicit `close()` that can throw and have the destructor swallow and log failures.
:::

:::bug{#U6 findings=ub}
```cpp
const char* p = std::string("abc").c_str();
std::puts(p);
```
::answer
UB: the temporary string dies at the semicolon, so `p` dangles. Keep the string alive in a named variable.
:::
