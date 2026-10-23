For each: is there UB? If so, which rule, and what's the fix? Some are fine.

:::bug{#U1 findings=ub}
```cpp
int i = 5;
int r = i++ * ++i;
```
::answer
UB: two unsequenced modifications of `i`.

*Review:* :sec[types-and-initialization/vocabulary-and-evaluation-order].
:::

:::bug{#U2 findings=ub}
```cpp
const int& m = std::min(1, 2);
cout << m;
```
::answer
UB: `std::min` returns a reference to one of the temporaries, which die at the end of the statement.

*Review:* :sec[object-lifetime/temporaries-and-lifetime-extension].
:::

:::bug{#U3 findings=ub}
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

*Review:* :sec[containers/vector].
:::

:::bug{#U4 findings=ub}
```cpp
struct Px { int ticks; };
Px p;
cout << p.ticks;
```
::answer
UB (erroneous behavior in C++26): `p` has automatic storage and `ticks` is never initialized. Write `Px p{};`.

*Review:* :sec[types-and-initialization/initialization].
:::

:::bug{#U5 findings=ub}
```cpp
std::string_view sv = std::string("BTC") + "-USD";
cout << sv;
```
::answer
UB on use: the concatenated temporary string dies at the semicolon.

*Review:* :sec[object-lifetime/common-dangling-patterns].
:::

:::bug{#U6 findings=ub}
```cpp run=none
for (int x : v) if (x < 0) v.push_back(-x);
```
::answer
UB: `push_back` may reallocate while the range-`for` holds iterators. Collect additions separately, or index with a saved size.

*Review:* :sec[object-lifetime/common-dangling-patterns].
:::

:::bug{#U7 findings=ub}
```cpp run=none
void Session::close() { delete this; log("closed", id_); }
```
::answer
UB: `id_` is read after the object is deleted. Copy what you need first, and make sure nothing touches the object after `delete this`.

*Review:* :sec[object-lifetime/storage-duration-and-lifetime], and `delete this` in the Guide.
:::

:::bug{#U8 findings=ub}
```cpp
char buf[16] = "abcdef";
std::memcpy(buf + 1, buf, 6);
```
::answer
UB: `memcpy` with overlapping ranges. Use `memmove`.

*Review:* :sec[pointers-references-arrays/pointer-arithmetic-rules].
:::

:::bug{#U9 findings=ub}
```cpp run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
int ticks = 0;
std::thread a([&] { ++ticks; }), b([&] { ++ticks; });
a.join(); b.join();
```
::answer
UB: data race on `ticks`. Use `std::atomic<int>`.

*Review:* :sec[memory-model/core-definitions].
:::

:::bug{#U10 findings=defined-bug}
```cpp
std::variant<int, double> v = 1.5;
int i = std::get<int>(v);
```
::answer
Not UB, but a defined bug: `std::get` throws `std::bad_variant_access`, and uncaught it terminates the program. Check with `std::holds_alternative` or use `std::get_if`.

*Review:* :sec[utilities/variant].
:::

:::bug{#U11 findings=none}
```cpp
int* p = nullptr;
delete p;
std::free(nullptr);
```
::answer
Nothing wrong: deleting a null pointer and freeing null are both no-ops.

*Review:* null pointers and `delete` in the Guide.
:::

:::bug{#U12 findings=ub}
```cpp
int x = INT_MAX;
long long y = x + 1;
```
::answer
UB: `x + 1` is computed in `int` and overflows before the conversion to `long long`. Write `x + 1LL`.

*Review:* :sec[types-and-initialization/the-usual-arithmetic-conversions], :sec[types-and-initialization/overflow-division-and-shifts].
:::

:::bug{#U13 findings=ub}
```cpp
std::vector<int> v{3, 1, 2};
std::sort(v.begin(), v.end(), [](int a, int b) { return a > b || a == b; });
```
::answer
UB: the comparator returns true for equal elements, so it isn't a strict weak ordering.

*Review:* :sec[algorithms-and-ranges/strict-weak-ordering].
:::

:::bug{#U14 findings=none}
```cpp
unsigned int u = UINT_MAX;
u += 1;
```
::answer
Nothing wrong: unsigned arithmetic wraps to 0, which is fully defined.

*Review:* :sec[types-and-initialization/overflow-division-and-shifts].
:::
