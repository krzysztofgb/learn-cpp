All snippets use this helper:

```cpp kind=fragment run=local
struct M {
    const char* n;
    M(const char* n) : n(n) { cout << '+' << n; }
    ~M() { cout << '-' << n; }
};
```

:::predict{#P1}
```cpp run=none
struct B { M m{"b"}; };
struct D : B { M x{"x"}; M y{"y"}; };
{ D d; }
```
::answer
`+b+x+y-y-x-b`

Base first, members in declaration order; destruction reversed.
:::

:::predict{#P2}
```cpp run=none
M make() { return M{"t"}; }
{
    const M& r = make();
    cout << '|';
}
cout << '.';
```
::answer
`+t|-t.`

Binding to `const M&` extends the temporary to the end of the block.
:::

:::predict{#P3}
```cpp run=none
{
    M("a");
    M b("b");
    cout << '|';
}
```
::answer
`+a-a+b|-b`

`M("a");` creates an unnamed temporary destroyed at the semicolon. The same mistake with `std::lock_guard<std::mutex>(m);` locks nothing useful.
:::

:::predict{#P4}
```cpp run=none
M& get() { static M m{"s"}; return m; }
int main() {
    cout << 'a'; get(); get(); cout << 'b';
}
```
::answer
`a+sb-s`

Constructed on first call, destroyed after `main` returns.
:::

:::predict{#P5}
```cpp run=none
struct S {
    M a{"a"};
    M b{"b"};
    S() { throw 1; }
    ~S() { cout << "~S"; }
};
try { S s; } catch (int) { cout << " caught"; }
```
::answer
`+a+b-b-a caught`

Fully constructed members are destroyed in reverse; `~S` never runs.
:::

:::predict{#P6}
(C++20 and C++23)

```cpp
struct Holder {
    std::vector<int> v{1, 2, 3};
    const std::vector<int>& get() const { return v; }
};
Holder make_holder() { return {}; }
for (int x : make_holder().get()) cout << x;
```
::answer
C++20: UB. C++23: `123`

Before C++23 the `Holder` temporary dies before the loop body runs. C++23 adopted P2718R0, which extends every temporary in the range initializer. **Compiler support lags:** GCC 15+ and Clang 19+ implement it (check `__cpp_range_based_for >= 202211L`). GCC 14 and Clang 18 still dangle even with `-std=c++23` (verified with ASan), so don't rely on the fix yet.
:::
