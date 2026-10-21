:::bug{#U1}
```cpp
std::string a = "abc";
const std::string& m = std::max(a, std::string("zzz"));
std::cout << m;
```
::answer
`std::max` returns a reference to its larger argument, the temporary. The temporary dies at the semicolon, so `m` dangles. Store the result by value.
:::

:::bug{#U2}
```cpp
std::function<int()> make_counter() {
    int count = 0;
    return [&] { return ++count; };
}
```
::answer
The lambda captures the local `count` by reference and outlives it. Capture by value with `mutable`: `[count = 0]() mutable { return ++count; }`.
:::

:::bug{#U3}
```cpp run=none
// prefix.cpp
std::string g_prefix = "MD:";
// topic.cpp
extern std::string g_prefix;
std::string g_topic = g_prefix + "AAPL";
```
::answer
If `topic.cpp`'s initializer runs first, it calls `operator+` on an unconstructed string: UB. It depends on link order.
:::

:::bug{#U4}
```cpp run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
void start(const Config& cfg) {
    std::thread t([&] { run(cfg); });
    t.detach();
}
// called as: start(Config{...});
```
::answer
The temporary `Config` dies when `start`'s caller finishes its full expression, while the detached thread still reads it. Copy it into the lambda: `[cfg] { run(cfg); }`.
:::

:::bug{#U5}
```cpp
struct Conn {
    ~Conn() { if (!flush()) throw std::runtime_error("flush failed"); }
    bool flush();
};
```
::answer
Not UB, but the throw calls `std::terminate`, because destructors are `noexcept`. Provide an explicit `close()` that can throw and have the destructor swallow and log failures.
:::

:::bug{#U6}
```cpp
const char* p = std::string("abc").c_str();
std::puts(p);
```
::answer
The temporary string dies at the semicolon; `p` dangles. Keep the string alive in a named variable.
:::
