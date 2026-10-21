Assume each snippet sits inside `main` with the needed headers, compiled as C++23 on your Mac unless the snippet says otherwise. Write your answer down for all 12 before checking the key. "UB", "implementation-defined" and "doesn't compile" are valid answers.

:::predict{#P1}
```cpp
unsigned u = 1;
int i = -1;
std::cout << (i < u) << '\n';
```
::answer
`0`

Usual arithmetic conversions turn `-1` into `UINT_MAX`, which isn't less than 1.
:::

:::predict{#P2}
```cpp
std::uint8_t a = 200, b = 100;
auto c = a + b;
std::cout << c << ' ' << sizeof(c) << '\n';
```
::answer
`300 4`

Both operands promote to `int`, so `c` is an `int` holding 300, not a wrapped `uint8_t`.
:::

:::predict{#P3}
```cpp
std::uint8_t x = 65;
std::cout << x << ' ' << +x << '\n';
```
::answer
`A 65`

`uint8_t` is `unsigned char`, so `<<` prints it as a character. Unary `+` promotes it to `int`.
:::

:::predict{#P4}
```cpp
std::vector<int> a(3, 7), b{3, 7};
std::cout << a.size() << ' ' << b.size() << '\n';
```
::answer
`3 2`

Parentheses call the (count, value) constructor. Braces pick the `initializer_list` constructor.
:::

:::predict{#P5}
(What does it print on your Mac, and on an ARM64 Linux server?)

```cpp
char c = static_cast<char>(0xFF);
std::cout << static_cast<int>(c) << '\n';
```
::answer
Mac: `-1`, Linux ARM64: `255`

Plain `char` is signed on Apple ARM64 and unsigned on Linux ARM64. The wrap to -1 is defined since C++20.
:::

:::predict{#P6}
(On your Mac, and on 64-bit Windows?)

~~~cpp note="In the browser this is wasm32, where `long` and pointers are 32-bit (like Windows), so this prints 0. On your Mac (LP64) it prints 1."
std::cout << (-1L < 1u) << '\n';
~~~
::answer
Mac: `1`, Windows: `0`

On LP64, `long` holds every `unsigned int`, so `1u` converts to `long`. On Windows both go to `unsigned long`, and `-1L` becomes huge.
:::

:::predict{#P7}
```cpp
auto a{5};
auto b = {5};
std::cout << std::is_same_v<decltype(a), int>
          << std::is_same_v<decltype(b), int> << '\n';
```
::answer
`10`

`auto a{5}` is `int` since C++17. `auto b = {5}` is `std::initializer_list<int>`.
:::

:::predict{#P8}
```cpp
int i = 0;
i = i++ + 1;
std::cout << i << '\n';
```
::answer
`1`

Well-defined since C++17: the right side, including the increment, finishes before the assignment. It was UB before C++17.
:::

:::predict{#P9}
```cpp
int x = 5;
decltype(x) a = x;
decltype((x)) b = x;
a = 7;
b = 10;
std::cout << x << '\n';
```
::answer
`10`

`decltype(x)` is `int` (a copy). `decltype((x))` is `int&`, so `b` aliases `x`.
:::

:::predict{#P10}
```cpp
std::cout << sizeof('a') << ' ' << sizeof(true + true) << ' '
          << (true + true) << '\n';
```
::answer
`1 4 2`

In C++ a character literal is a `char` (in C it's an `int`). `bool + bool` promotes to `int`.
:::

:::predict{#P11}
```cpp
double d = 0.1 + 0.2;
std::cout << (d == 0.3) << ' ' << (0.5 + 0.25 == 0.75) << '\n';
```
::answer
`0 1`

0.1, 0.2 and 0.3 have no exact binary form. 0.5, 0.25 and 0.75 do.
:::

:::predict{#P12}
(the whole program)

```cpp
#include <iostream>
struct Timer {
    Timer() { std::cout << "start "; }
};
int main() {
    Timer t();
    std::cout << "done\n";
}
```
::answer
`done`

`Timer t();` declares a function, so no `Timer` is constructed. Clang warns with `-Wvexing-parse`.
:::
