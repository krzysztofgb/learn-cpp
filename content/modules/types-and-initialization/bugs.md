Each snippet compiles. For each, say whether it has UB, which rule it breaks, and how to fix it. Not every line is broken, and not every problem is UB: some lines are fine, and some are merely unspecified. Say which is which.

:::bug{#U1 findings=ub}
```cpp
bool will_overflow(int x) {
    return x + 1 < x;
}
```
::answer
UB when `x == INT_MAX`. Because overflow "can't happen", the optimizer compiles the function to `return false`. Fix: `return x == INT_MAX;`.
:::

:::bug{#U2 findings=ub}
```cpp
void print_reversed(const std::vector<int>& v) {
    for (std::size_t i = v.size() - 1; i >= 0; --i)
        std::cout << v[i] << '\n';
}
```
::answer
UB: the condition `i >= 0` is always true for an unsigned `i`. That wrap itself is defined, but when `i` wraps to `SIZE_MAX`, `v[i]` reads out of bounds, which is UB. On an empty vector the very first read is already out of bounds. Fix: `for (std::size_t i = v.size(); i-- > 0;)` or iterate `v | std::views::reverse`.
:::

:::bug{#U3 findings=ub}
```cpp
std::uint16_t a = 50000, b = 50000;
std::uint32_t area = a * b;
```
::answer
UB. Both operands promote to signed `int`, and 2.5 billion exceeds `INT_MAX`. Converting the result to `uint32_t` afterwards is too late. Fix: `std::uint32_t area = std::uint32_t{a} * b;`.
:::

:::bug{#U4 findings=ub}
```cpp
int pick(bool cond) {
    int x;
    if (cond) x = 1;
    return x;
}
```
::answer
UB when `cond` is false: `x` is read uninitialized, which is UB through C++23 and erroneous behavior in C++26. Fix: initialize at the declaration.
:::

:::bug{#U5 findings=ub}
```cpp
std::uint32_t mask_for(int bits) {   // called with bits == 32
    return (1u << bits) - 1;
}
```
::answer
UB, since a shift count equal to the operand's width is out of range. In practice, x86 and ARM hardware mask the count so a runtime shift by 32 often gives 1 (and a mask of 0), while a constant-folded call may give something else. Fix: `return bits >= 32 ? ~0u : (1u << bits) - 1;`.
:::

:::bug{#U6 findings=ub}
```cpp
int negate(int a) { return -a; }     // called with INT_MIN
```
::answer
UB, because `-INT_MIN` doesn't fit in `int`. Fix: check for `INT_MIN`, or return a wider type.
:::

:::bug{#U7 findings=ub}
```cpp
double notional = 3e10;
int n = static_cast<int>(notional);
```
::answer
UB, because 3e10 is outside `int`'s range and floating-to-integer conversion of an out-of-range value is undefined. Fix: range-check first, or use `std::int64_t` with a check.
:::

:::bug{#U8 findings=ub}
```cpp
const int limit = 10;
const_cast<int&>(limit) = 20;
std::cout << limit << '\n';
```
::answer
UB, since `limit` was defined `const`. It likely prints `10` because the compiler substituted the constant, and a `const` global in read-only memory would crash instead. There's no fix other than not doing it.
:::

:::bug{#U9 findings=ub,unspecified}
```cpp run=none
int i = 0;
int r = i++ + i++;
f(i++, i++);   // void f(int, int)
```
::answer
UB and unspecified: `i++ + i++` is UB (two unsequenced modifications of `i`), while `f(i++, i++)` is *not* UB since C++17. Arguments are indeterminately sequenced, so it's unspecified which parameter gets which value. It was UB before C++17.
:::

:::bug{#U10 findings=ub}
```cpp
int arr[4] = {};
int* end = arr + 4;
int* past = arr + 5;
```
::answer
UB on the last line: `arr + 5` is UB just by being computed, before any dereference. `arr + 4` is fine: you can form (but not dereference) the one-past-the-end pointer.
:::
