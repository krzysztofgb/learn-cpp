:::predict{#P1}
```cpp
void f(int&)  { cout << 'L'; }
void f(int&&) { cout << 'R'; }
int x = 1;
int&& r = 2;
f(x); f(1); f(std::move(x)); f(r);
```
::answer
`LRRL`

`r` has type `int&&` but, being a named variable, is an lvalue.
:::

:::predict{#P2}
```cpp
struct S {
    S() = default;
    S(const S&) { cout << 'C'; }
    S(S&&)      { cout << 'M'; }
};
const S a;
S b = std::move(a);
```
::answer
`C`

`std::move(a)` is `const S&&`, which binds only to the copy constructor.
:::

:::predict{#P3}
(`S` as in P2, plus `S() { cout << 'D'; }`)

```cpp run=none
S make() { return S{}; }
S s = make();
```
::answer
`D`

Guaranteed elision: one construction directly into `s`.
:::

:::predict{#P4}
(same `S`)

```cpp run=none
S g() { S local; return std::move(local); }
S h() { S local; return local; }
g(); cout << '|'; h();
```
::answer
`DM|D`

`std::move` defeats NRVO in `g`. In `h`, Clang and GCC apply NRVO (not guaranteed; without it you'd see an implicit move).
:::

:::predict{#P5}
(`f` from P1)

```cpp run=none
template <class T> void wrap(T&& t) {
    f(t);
    f(std::forward<T>(t));
}
int x = 1;
wrap(x); wrap(1);
```
::answer
`LLLR`

`t` is always an lvalue; `forward` restores the original category.
:::

:::predict{#P6 expect=unspecified}
```cpp
std::string a = "a string too long for the small-string buffer";
std::string b = std::move(a);
cout << a.size();
```
::answer
Unspecified (`0` in practice)

Valid but unspecified state. libc++ and libstdc++ both leave it empty.
:::
