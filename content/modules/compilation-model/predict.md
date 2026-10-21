:::predict{#P1}
```cpp
void f(long)   { cout << "long"; }
void f(double) { cout << "double"; }
f(1);
```
::answer
Doesn't compile

`int`→`long` and `int`→`double` are both standard conversions, so the call is ambiguous.
:::

:::predict{#P2}
```cpp
void f(int)    { cout << "int "; }
void f(double) { cout << "double "; }
f('a'); f(1.0f);
```
::answer
` int double  `

`char`→`int` and `float`→`double` are promotions, which beat conversions.
:::

:::predict{#P3}
```cpp
struct B { void f(int)    { cout << "B::f(int)"; } };
struct D : B { void f(double) { cout << "D::f(double)"; } };
D d; d.f(1);
```
::answer
`D::f(double)`

`D::f` hides `B::f`; lookup stops in `D` before overload resolution.
:::

:::predict{#P4}
```cpp
template <class T> void g(T) { cout << "T "; }
void g(int) { cout << "int "; }
g(1); g(1u); g<>(1);
```
::answer
` int T T  `

Exact non-template beats template. `1u` makes `T = unsigned` an exact match, better than the `unsigned`→`int` conversion. `g<>` forces a template.
:::

:::predict{#P5}
```cpp
struct B { virtual void f(int x = 1) { cout << "B" << x; } };
struct D : B { void f(int x = 2) override { cout << "D" << x; } };
B* p = new D;
p->f();
```
::answer
`D1`

Dispatch is dynamic, but the default argument comes from the static type `B`.
:::

:::predict{#P6}
```cpp
namespace lib {
    struct Px {};
    void print(Px) { cout << "lib"; }
}
void print(...) { cout << "global"; }
// in main:
lib::Px p; print(p);
```
::answer
`lib`

ADL finds `lib::print`, an exact match that beats the ellipsis.
:::

:::predict{#P7}
```cpp
int counter() { static int n = 0; return ++n; }
cout << counter() << counter() << counter();
```
::answer
`123`

Since C++17, `<<` operands evaluate left to right. The local static persists across calls.
:::
