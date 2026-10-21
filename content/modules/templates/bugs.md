:::bug{#U1}
```cpp run=none
// traits.h
template <class T> struct Traits { static constexpr int width = 8; };
// a.cpp: uses Traits<Price>::width
// b.cpp:
template <> struct Traits<Price> { static constexpr int width = 16; };
```
::answer
ODR violation, no diagnostic required: `a.cpp` instantiates the primary for `Price`, `b.cpp` uses the specialization. Declare the specialization in `traits.h` next to the primary.
:::

:::bug{#U2}
```cpp run=none
template <class T>
const T& clamp_ref(const T& v, const T& lo, const T& hi) {
    return v < lo ? lo : (hi < v ? hi : v);
}
const int& r = clamp_ref(x, 0, 100);
std::cout << r;
```
::answer
`0` and `100` bind to temporaries that die at the end of the statement. If `x` is out of range, `r` dangles. Return by value for small types. (`std::clamp` has the same trap.)
:::

:::bug{#U3}
```cpp
template <class Container>
void print_first(const Container& c) {
    Container::const_iterator it = c.begin();
    std::cout << *it;
}
```
::answer
Doesn't compile: `Container::const_iterator` is a dependent type and needs `typename`. Or just write `auto`.
:::

:::bug{#U4}
```cpp
template <class T> T max_of(T a, T b) { return a < b ? b : a; }
auto m = max_of(qty, 2.5);   // qty is int
```
::answer
Doesn't compile: `T` deduces to `int` from one argument and `double` from the other. Use `max_of<double>(qty, 2.5)` or two type parameters.
:::
