:::bug{#U1 findings=ub}
```cpp run=none
std::sort(px.begin(), px.end(), [](int a, int b) { return a <= b; });
```
::answer
UB: `<=` isn't irreflexive. `std::sort` may run past the end of the range. Use `<`.
:::

:::bug{#U2 findings=ub}
```cpp run=none
std::vector<double> prices = load();   // may contain NaN
std::sort(prices.begin(), prices.end());
```
::answer
UB if NaN is present: every comparison with NaN is false, breaking transitivity of equivalence. Filter NaNs first, or sort with `std::ranges::sort` and a comparator based on `std::strong_order` for doubles (C++20 total order).
:::

:::bug{#U3 findings=ub}
```cpp
std::vector<int> v{5, 3, 9, 1};
bool found = std::binary_search(v.begin(), v.end(), 9);
```
::answer
UB: a precondition violation, because the range must be partitioned with respect to the value and this one isn't. In practice it's a wrong answer.
:::

:::bug{#U4 findings=ub}
```cpp
std::vector<int> src{1, 2, 3}, dst;
std::copy(src.begin(), src.end(), dst.begin());
```
::answer
UB: writes past the end of an empty vector. Use `std::back_inserter(dst)` or `dst.resize` first.
:::

:::bug{#U5 findings=ub}
```cpp
std::vector<int> v{2, 4, 5, 6};
auto evens = v | std::views::filter([](int x) { return x % 2 == 0; });
for (int& x : evens) x += 1;
```
::answer
UB: after incrementing, 2 becomes 3, which no longer satisfies the predicate, which `filter_view` forbids.
:::

:::bug{#U6 findings=compile-error}
```cpp
std::vector<int> make_vec();
auto it = std::ranges::find(make_vec(), 3);
std::cout << *it;
```
::answer
Doesn't compile: `it` is `std::ranges::dangling`. The library caught a use-after-free for you.
:::
