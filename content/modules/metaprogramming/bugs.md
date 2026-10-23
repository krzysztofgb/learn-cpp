:::bug{#U1 findings=ub}
```cpp run=none
template <class D> struct Shape {
    double area() { return static_cast<D*>(this)->area_impl(); }
};
struct Circle : Shape<Circle> { double area_impl(); };
struct Square : Shape<Circle> { double area_impl(); };
Square{}.area();
```
::answer
UB: `Square` derives from `Shape<Circle>`, so `area()` casts a `Square` to `Circle`. Prevent it with a private constructor in `Shape` and `friend D;`.
:::

:::bug{#U2 findings=none}
```cpp
template <class T> void encode(T v) {
    if constexpr (std::is_integral_v<T>) { /* ... */ }
    else static_assert(false, "unsupported type");
}
```
::answer
Nothing wrong in C++23: P2593 (adopted as a defect report) makes `static_assert(false)` in a discarded branch fine, and current Clang and GCC accept it. Before it, this was ill-formed even when the branch was discarded; the portable old trick is a dependent false: `static_assert(sizeof(T) == 0, ...)`.
:::

:::bug{#U3 findings=ub,compile-error}
```cpp
constexpr int next(int x) { return x + 1; }
int a = next(INT_MAX);
constexpr int b = next(INT_MAX);
```
::answer
Both UB and a compile error: `a` is runtime UB (signed overflow, not diagnosed), and `b` is a compile error, because constant evaluation must diagnose UB.
:::

:::bug{#U4 findings=compile-error}
```cpp
template <class T, class = std::enable_if_t<std::is_integral_v<T>>>
void store(T);
template <class T, class = std::enable_if_t<std::is_floating_point_v<T>>>
void store(T);
```
::answer
Doesn't compile: both declare the same template signature (default template arguments aren't part of it). Use `std::enable_if_t<..., int> = 0` as a non-type parameter, or concepts.
:::
