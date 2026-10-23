:::predict{#P1}
```cpp
struct V {
    int a, b;
    auto operator<=>(const V&) const = default;
};
cout << (V{1, 5} < V{2, 0}) << (V{1, 5} == V{1, 5});
```
::answer
`11`

Lexicographic by `a`, then `b`; defaulted `<=>` also gives `==`.
:::

:::predict{#P2}
```cpp
auto r = 1.0 <=> std::nan("");
cout << (r == std::partial_ordering::unordered)
     << (1.0 < std::nan(""))
     << (1.0 >= std::nan(""));
```
::answer
`100`

NaN is unordered: all relational comparisons are false.
:::

:::predict{#P3}
```cpp
struct S {
    void who(this auto&& self) {
        using Self = std::remove_reference_t<decltype(self)>;
        cout << (std::is_const_v<Self> ? 'c' : 'm');
    }
};
S s; const S cs;
s.who(); cs.who(); S{}.who();
```
::answer
`mcm`

`self` deduces `S&`, `const S&` and `S&&`.
:::

:::predict{#P4}
```cpp run=none
std::generator<int> nums() {
    for (int i = 0;; ++i) { cout << 'y'; co_yield i; }
}
for (int x : nums() | std::views::take(3)) cout << x;
```
::answer
`y0y1y2y`

A generator isn't a sized range, so `take_view::begin()` returns `counted_iterator(ranges::begin(base_), count_)` (\[range.take.view\]). `counted_iterator::operator++` is specified as `++current; --length;` (\[counted.iter.nav\]), so the step that drops the count to 0 still resumes the generator, printing a fourth `y`. Verified with GCC 14.
:::

:::predict{#P5}
```cpp
struct P { int x, y, z; };
P p{.x = 1, .z = 3};
cout << p.y;
// P q{.y = 1, .x = 2};   // what happens if uncommented?
```
::choices
- [ ] Prints an indeterminate value; uncommented: compile error
- [ ] Prints `0`; uncommented: compiles, with `q.x == 2` and `q.y == 1`
- [x] Prints `0`; uncommented: compile error
- [ ] Prints `0`; uncommented: compiles with only a warning
::answer
`0`; uncommented: compile error

Unnamed members are value-initialized; designators must follow declaration order.
:::

:::predict{#P6}
```cpp
struct Price {
    long ticks;
    auto operator<=>(const Price&) const = default;
};
std::vector<Price> v{{3}, {1}, {2}};
std::ranges::sort(v);
cout << v.front().ticks << (Price{2} != Price{3});
```
::answer
`11`

Defaulted `<=>` makes `Price` sortable; `!=` is rewritten as `!(==)`.
:::
