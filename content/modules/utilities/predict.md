:::predict{#P1}
```cpp
std::pair<int, int> p{1, 2};
auto [a, b] = p;
a = 10;
cout << p.first;
auto& [c, d] = p;
c = 10;
cout << p.first;
```
::answer
`110`

`auto [a, b]` binds to a copy; `auto& [c, d]` binds to `p`.
:::

:::predict{#P2}
```cpp
std::variant<std::string, bool> v = "abc";
cout << v.index();    // compiled as C++20
```
::answer
`0`

C++20 picks `std::string`; earlier standards picked `bool` (index 1).
:::

:::predict{#P3}
```cpp
std::optional<int> a, b = 0;
cout << (a < b) << (a == std::nullopt) << (b == 0);
```
::answer
`111`

An empty optional compares less than any value.
:::

:::predict{#P4}
```cpp
int x = 1;
auto f = [x] { return x; };
auto g = [&x] { return x; };
x = 2;
cout << f() << g();
```
::answer
`12`

`f` copied 1 at creation; `g` reads `x` at call time.
:::

:::predict{#P5}
```cpp
auto counter = [n = 0]() mutable { return ++n; };
auto copy = counter;
counter(); counter();
cout << copy() << counter();
```
::answer
`13`

`copy` has its own `n`, copied when it was 0.
:::

:::predict{#P6}
```cpp
using namespace std::chrono;
cout << duration_cast<milliseconds>(1999us).count() << ' '
     << round<milliseconds>(1999us).count();
```
::answer
`1 2`

`duration_cast` truncates; `round` rounds to nearest.
:::
