For each: is there UB? If so, which rule, and what's the fix? Some are fine.

:::bug{#U1}
```cpp
int i = 5;
int r = i++ * ++i;
```
::answer
UB: two unsequenced modifications of `i`.
:::

:::bug{#U2}
```cpp
const int& m = std::min(1, 2);
cout << m;
```
::answer
UB: `std::min` returns a reference to one of the temporaries, which die at the end of the statement.
:::

:::bug{#U3}
```cpp
std::vector<int> v;
v.reserve(2);
int* p = &v.emplace_back(1);
v.push_back(2);
v.push_back(3);
cout << *p;
```
::answer
UB: the third insertion exceeds capacity 2 and reallocates, so `p` dangles.
:::

:::bug{#U4}
```cpp
struct Px { int ticks; };
Px p;
cout << p.ticks;
```
::answer
UB (erroneous behavior in C++26): `p` has automatic storage and `ticks` is never initialized. Write `Px p{};`.
:::

:::bug{#U5}
```cpp
std::string_view sv = std::string("BTC") + "-USD";
cout << sv;
```
::answer
UB on use: the concatenated temporary string dies at the semicolon.
:::

:::bug{#U6}
```cpp run=none
for (int x : v) if (x < 0) v.push_back(-x);
```
::answer
UB: `push_back` may reallocate while the range-`for` holds iterators. Collect additions separately, or index with a saved size.
:::

:::bug{#U7}
```cpp run=none
void Session::close() { delete this; log("closed", id_); }
```
::answer
UB: `id_` is read after the object is deleted. Copy what you need first, and make sure nothing touches the object after `delete this`.
:::

:::bug{#U8}
```cpp
char buf[16] = "abcdef";
std::memcpy(buf + 1, buf, 6);
```
::answer
UB: `memcpy` with overlapping ranges. Use `memmove`.
:::

:::bug{#U9}
```cpp run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
int ticks = 0;
std::thread a([&] { ++ticks; }), b([&] { ++ticks; });
a.join(); b.join();
```
::answer
UB: data race on `ticks`. Use `std::atomic<int>`.
:::

:::bug{#U10}
```cpp
std::variant<int, double> v = 1.5;
int i = std::get<int>(v);
```
::answer
Not UB: `std::get` throws `std::bad_variant_access`.
:::

:::bug{#U11}
```cpp
int* p = nullptr;
delete p;
std::free(nullptr);
```
::answer
Not UB: deleting a null pointer and freeing null are both no-ops.
:::

:::bug{#U12}
```cpp
int x = INT_MAX;
long long y = x + 1;
```
::answer
UB: `x + 1` is computed in `int` and overflows before the conversion to `long long`. Write `x + 1LL`.
:::

:::bug{#U13}
```cpp
std::vector<int> v{3, 1, 2};
std::sort(v.begin(), v.end(), [](int a, int b) { return a > b || a == b; });
```
::answer
UB: the comparator returns true for equal elements, so it isn't a strict weak ordering.
:::

:::bug{#U14}
```cpp
unsigned int u = UINT_MAX;
u += 1;
```
::answer
Not UB: unsigned arithmetic wraps to 0.
:::
