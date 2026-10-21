:::bug{#U1}
```cpp
float f = 1.0f;
std::uint32_t bits = *reinterpret_cast<std::uint32_t*>(&f);
```
::answer
Strict aliasing violation. Use `std::bit_cast<std::uint32_t>(f)`.
:::

:::bug{#U2}
```cpp
union U { float f; std::uint32_t u; };
U x;
x.f = 1.0f;
return x.u;
```
::answer
UB in C++: reading an inactive union member. GCC and Clang define it as an extension; portable code uses `bit_cast`.
:::

:::bug{#U3}
```cpp
struct Header { std::uint32_t seq; std::uint16_t len; };
std::uint32_t read_seq(const char* packet) {
    auto* h = reinterpret_cast<const Header*>(packet + 3);
    return h->seq;
}
```
::answer
Misaligned access (offset 3) and accessing bytes as a `Header` object that doesn't exist (and `Header` has 2 bytes of tail padding the wire format may not). Use `memcpy` of each field, then byte-swap if the wire is big-endian.
:::

:::bug{#U4}
```cpp
struct Instrument { std::string symbol; double tick; };
auto* in = static_cast<Instrument*>(std::malloc(sizeof(Instrument)));
in->symbol = "ESZ6";
```
::answer
No constructor ever ran for the `std::string` member, so `symbol =` calls assignment on an object that was never initialized: UB. Implicit object creation can't help, because `std::string` needs its constructor to establish its invariants. Use placement new or just `new`.
:::

:::bug{#U5}
```cpp
int* p = new int;
std::free(p);
```
::answer
Mismatched allocation and deallocation functions.
:::

:::bug{#U6}
```cpp
void reset(std::string& s) {
    s.~basic_string();
}
// called on a local std::string, which is later destroyed at scope end
```
::answer
The string is destroyed twice: once explicitly and again at scope end. Use `s.clear()` or `s = {}`.
:::
