:::bug{#U1 findings=ub}
```cpp
std::vector<int> v;
v.reserve(10);
v[0] = 1;
```
::answer
UB: `size()` is 0, so `v[0]` is out of range despite capacity. Use `push_back` or `resize`.
:::

:::bug{#U2 findings=ub}
```cpp run=none
for (auto it = v.begin(); it != v.end(); ++it)
    if (*it % 2) v.erase(it);
```
::answer
UB: `erase` invalidates `it`, then `++it` uses it. Write `it = v.erase(it);` and only increment otherwise, or use `std::erase_if(v, pred)`.
:::

:::bug{#U3 findings=ub}
```cpp run=none
int& first = v[0];
v.push_back(42);
++first;
```
::answer
UB if `push_back` reallocated: `first` dangles.
:::

:::bug{#U4 findings=none}
```cpp
std::vector<int> v{1, 2, 3};
v.push_back(v[0]);
```
::answer
Nothing wrong: for std::vector the standard has no rule forbidding it, and the committee's position (LWG 526, LWG 2164) is that it must work. Not every vector-like container agrees; Boost.Container calls it UB.
:::

:::bug{#U5 findings=ub}
```cpp
std::string_view venue() { return std::string("XNAS"); }
```
::answer
UB on use: the view outlives the temporary string. Return `std::string`, or a view of something with static storage (`return "XNAS";` works).
:::

:::bug{#U6 findings=ub}
```cpp
std::set<int, std::less_equal<int>> s{3, 1, 3};
```
::answer
UB: `less_equal` isn't a strict weak ordering (`a <= a` is true), so the set's invariants break.
:::
