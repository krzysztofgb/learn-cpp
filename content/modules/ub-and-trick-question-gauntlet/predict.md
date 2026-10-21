Assume `#include`s, `using std::cout;`, C++20, 64-bit Linux or macOS.

:::predict{#Q1}
```cpp
unsigned char a = 200, b = 100;
cout << (a + b > 255);
```
::answer
`1`

Both operands promote to `int`; 300 > 255.
:::

:::predict{#Q2}
```cpp
cout << (sizeof(int) > -1);
```
::answer
`0`

`-1` converts to `size_t`, becoming the largest value.
:::

:::predict{#Q3}
```cpp
struct B { virtual ~B() { f(); } virtual void f() { cout << "B"; } };
struct D : B { void f() override { cout << "D"; } };
{ D d; }
```
::answer
`B`

During `~B`, the object is a `B`; `D` is already destroyed.
:::

:::predict{#Q4}
```cpp
std::string s = "abc";
s += 'd' + 1;
cout << s;
```
::answer
`abce`

`'d' + 1` is the `int` 101, converted to `char` `'e'` by `operator+=(char)`.
:::

:::predict{#Q5}
```cpp
void g(std::string) { cout << "str"; }
void g(bool)        { cout << "bool"; }
g("hi");
```
::answer
`bool`

Pointer-to-bool is a standard conversion, which beats the user-defined conversion to `std::string`.
:::

:::predict{#Q6}
```cpp
std::vector<int> v{1, 2, 3};
for (auto x : v) x *= 2;
cout << v[0];
```
::answer
`1`

`auto x` copies each element.
:::

:::predict{#Q7}
~~~cpp note="In the browser this is wasm32, where `long` and pointers are 32-bit, so this prints 4 here."
int a[] = {1, 2, 3};
auto b = a;
cout << sizeof(b);
~~~
::answer
`8`

`auto` decays the array to `int*`.
:::

:::predict{#Q8}
```cpp
cout << (0.1f == 0.1);
```
::answer
`0`

`0.1f` widened to `double` isn't the double closest to 0.1.
:::

:::predict{#Q9}
```cpp
std::map<int, int> m{{1, 1}};
auto [it, ok] = m.insert({1, 5});
cout << ok << it->second;
```
::answer
`01`

Insert fails when the key exists and returns the existing element.
:::

:::predict{#Q10}
```cpp
template <class T> int counter() { static int n = 0; return ++n; }
counter<int>(); counter<int>();
cout << counter<int>() << counter<double>();
```
::answer
`31`

Each instantiation has its own static.
:::

:::predict{#Q11}
```cpp
struct A {
    A() { cout << "A"; }
    A(const A&) { cout << "c"; }
};
A pass(A a) { return a; }
pass(A());
```
::answer
`Ac`

The prvalue argument initializes the parameter directly. The return can't elide a parameter, and the user-declared copy constructor suppresses the implicit move, so it copies.
:::

:::predict{#Q12}
```cpp
int x = 0;
auto f = [=]() mutable { return ++x; };
f(); f();
cout << x << f();
```
::answer
`03`

The lambda modifies its own copy.
:::

:::predict{#Q13}
```cpp
cout << -5 / 2 << ' ' << -5 % 2 << ' ' << (-5 >> 1);
```
::answer
`-2 -1 -3`

Division truncates toward zero; `%` follows; `>>` on negatives is arithmetic (defined since C++20).
:::

:::predict{#Q14}
```cpp
int a = 1;
int b = (a++, a++, a);
cout << b;
```
::answer
`3`

The built-in comma operator sequences left to right.
:::

:::predict{#Q15}
```cpp
cout << std::boolalpha << (std::string("10") < std::string("9"));
```
::answer
`true`

Strings compare lexicographically: `'1' < '9'`.
:::

:::predict{#Q16}
```cpp
std::array<int, 3> a{};
cout << a.size() << sizeof(a);
```
::answer
`312`

Three elements, 12 bytes, no overhead.
:::

:::predict{#Q17}
```cpp
auto big = 2147483648;
cout << sizeof(big);
```
::answer
`8`

The literal doesn't fit in `int`, so its type is `long` (LP64).
:::

:::predict{#Q18}
```cpp
cout << (true ? 1 : 2.0) << ' ' << sizeof(true ? 1 : 2.0);
```
::answer
`1 8`

The conditional's type is `double`; `1.0` prints as `1`.
:::

:::predict{#Q19}
```cpp
unsigned u = 0;
cout << u - 1;
```
::answer
`4294967295`

Unsigned arithmetic wraps.
:::

:::predict{#Q20}
(C++20, and what about C++17?)

```cpp
cout << (1 << 31);
```
::answer
`-2147483648`; implementation-defined in C++14/17; UB in C++11

C++20 \[expr.shift\]: the result is the value congruent to 1 × 2³¹ modulo 2³². C++14/17: 2³¹ fits in `unsigned int`, so it's converted to `int`, an implementation-defined conversion. C++11 required the result to fit in `int` itself, so it was UB.
:::

:::predict{#Q21}
```cpp
std::vector<bool> vb(3);
auto& r = vb[0];
```
::answer
Doesn't compile

`vb[0]` returns a proxy prvalue, which can't bind to a non-`const` lvalue reference.
:::

:::predict{#Q22}
```cpp
auto m = std::max('a', 98);
```
::answer
Doesn't compile

`T` can't be both `char` and `int`.
:::
