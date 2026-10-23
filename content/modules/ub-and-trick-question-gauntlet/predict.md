Assume `#include`s, `using std::cout;`, C++20, and a 64-bit Linux, macOS or Windows machine.

:::predict{#Q1}
```cpp
unsigned char a = 200, b = 100;
cout << (a + b > 255);
```
::answer
`1`

Both operands promote to `int`; 300 > 255.

*Review:* :sec[types-and-initialization/integer-promotion].
:::

:::predict{#Q2}
```cpp
cout << (sizeof(int) > -1);
```
::answer
`0`

`-1` converts to `size_t`, becoming the largest value.

*Review:* :sec[types-and-initialization/the-usual-arithmetic-conversions].
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

*Review:* :sec[polymorphism/rules-that-bite].
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

*Review:* :sec[types-and-initialization/integer-promotion], and argument conversion in the Guide.
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

*Review:* :sec[compilation-model/overload-resolution], and the boolean conversion in the Guide.
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

*Review:* :sec[types-and-initialization/auto-and-decltype].
:::

:::predict{#Q7}
~~~cpp note="In the browser this is wasm32, where `long` and pointers are 32-bit, so this prints 4 here."
int a[] = {1, 2, 3};
auto b = a;
cout << sizeof(b);
~~~
::choices
- [ ] `12`: `b` is a copy of the whole array
- [ ] `4`: the size of the first element
- [x] The size of an `int*`: `8` on 64-bit platforms
- [ ] Doesn't compile: arrays can't be copied
::answer
`8` on a 64-bit platform (`4` on 32-bit targets such as the browser's wasm32).

`auto` decays the array to `int*`.

*Review:* :sec[pointers-references-arrays/arrays-and-decay].
:::

:::predict{#Q8}
```cpp
cout << (0.1f == 0.1);
```
::answer
`0`

`0.1f` widened to `double` isn't the double closest to 0.1.

*Review:* :sec[types-and-initialization/floating-point-in-one-paragraph], and floating-point widening in the Guide.
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

*Review:* :sec[containers/associative-containers], and `insert` in the Guide.
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

*Review:* :sec[templates/instantiation-and-lookup], and statics in templates in the Guide.
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

*Review:* :sec[value-categories-and-moves/copy-elision], :sec[classes/the-special-members], and returning a parameter in the Guide.
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

*Review:* :sec[utilities/callables-lambdas-and-std-function].
:::

:::predict{#Q13}
```cpp
cout << -5 / 2 << ' ' << -5 % 2 << ' ' << (-5 >> 1);
```
::answer
`-2 -1 -3`

Division truncates toward zero; `%` follows; `>>` on negatives is arithmetic (defined since C++20).

*Review:* :sec[types-and-initialization/overflow-division-and-shifts], and division in the Guide.
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

*Review:* :sec[types-and-initialization/vocabulary-and-evaluation-order], and the comma operator in the Guide.
:::

:::predict{#Q15}
```cpp
cout << std::boolalpha << (std::string("10") < std::string("9"));
```
::answer
`true`

Strings compare lexicographically: `'1' < '9'`.

*Review:* :sec[containers/strings], and string comparison in the Guide.
:::

:::predict{#Q16}
```cpp
std::array<int, 3> a{};
cout << a.size() << sizeof(a);
```
::answer
`312`

Three elements, 12 bytes, no overhead.

*Review:* :sec[containers/complexity-and-layout-at-a-glance].
:::

:::predict{#Q17}
```cpp
auto big = 2147483648;
cout << sizeof(big);
```
::answer
`8`

The literal doesn't fit in `int`, so its type is the next of `long` and `long long` that holds it: `long` on LP64 (Linux, macOS), `long long` on Windows, where `long` is 32 bits. Both are 8 bytes.

*Review:* :sec[types-and-initialization/fundamental-types-what-s-guaranteed], and literal types in the Guide.
:::

:::predict{#Q18}
```cpp
cout << (true ? 1 : 2.0) << ' ' << sizeof(true ? 1 : 2.0);
```
::answer
`1 8`

The conditional's type is `double`; `1.0` prints as `1`.

*Review:* :sec[value-categories-and-moves/value-categories], and the conditional operator in the Guide.
:::

:::predict{#Q19}
```cpp
unsigned u = 0;
cout << u - 1;
```
::answer
`4294967295`

Unsigned arithmetic wraps.

*Review:* :sec[types-and-initialization/overflow-division-and-shifts].
:::

:::predict{#Q20}
(C++20, and what about C++17?)

```cpp
cout << (1 << 31);
```
::choices
- [ ] C++20: prints `-2147483648`; C++17: UB
- [ ] C++20: prints `2147483648`; C++17: implementation-defined
- [x] C++20: prints `-2147483648`; C++17: implementation-defined
- [ ] C++20: UB; C++17: UB
- [ ] C++20: prints `-2147483648`; C++17: the same, fully defined
::answer
C++20 prints `-2147483648`; C++14/17 make it implementation-defined; C++11 made it UB.

C++20 \[expr.shift\]: the result is the value congruent to 1 × 2³¹ modulo 2³². C++14/17: 2³¹ fits in `unsigned int`, so it's converted to `int`, an implementation-defined conversion. C++11 required the result to fit in `int` itself, so it was UB.

*Review:* :sec[types-and-initialization/overflow-division-and-shifts], and shifts before C++20 in the Guide.
:::

:::predict{#Q21 expect=compile-error}
```cpp
std::vector<bool> vb(3);
auto& r = vb[0];
```
::answer
Doesn't compile

`vb[0]` returns a proxy prvalue, which can't bind to a non-`const` lvalue reference.

*Review:* :sec[containers/vector].
:::

:::predict{#Q22 expect=compile-error}
```cpp
auto m = std::max('a', 98);
```
::answer
Doesn't compile

`T` can't be both `char` and `int`.

*Review:* :sec[templates/argument-deduction].
:::
