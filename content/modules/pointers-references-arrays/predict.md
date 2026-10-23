Assume headers, `main`, and `using std::cout;`. 64-bit macOS or Linux (LP64: 8-byte pointers, 4-byte `int`).

:::predict{#P1}
```cpp
int a[10];
cout << sizeof(a) << ' ' << std::size(a);
```
::answer
`40 10`

`sizeof` on an array is the whole array: 10 × 4 bytes.
:::

:::predict{#P2}
~~~cpp note="This only defines f; add int x[10]; f(x); to call it. In the browser this is wasm32, where `long` and pointers are 32-bit, so it prints 4 here."
void f(int a[10]) { cout << sizeof(a); }
// called as: int x[10]; f(x);
~~~
::answer
`8`

The parameter is really `int*`. Clang warns with `-Wsizeof-array-argument`.
:::

:::predict{#P3}
```cpp
int a[3] = {1, 2, 3};
cout << 2[a];
```
::answer
`3`

`2[a]` is `*(2 + a)`, the same as `a[2]`.
:::

:::predict{#P4 expect=unspecified}
```cpp
const char* s1 = "hi";
const char* s2 = "hi";
cout << (s1 == s2);
```
::answer
Unspecified

Identical literals may or may not share storage. In practice usually `1`, because compilers merge them.
:::

:::predict{#P5}
```cpp note="wasi-libc defines NULL so that g(NULL) picks g(int) here. With Clang or GCC on macOS and Linux the call is ambiguous: try it in Compiler Explorer."
void g(int)   { cout << "int "; }
void g(char*) { cout << "ptr "; }
g(0); g(nullptr); g(NULL);
```
::choices
- [ ] `int ptr int`
- [ ] `int ptr ptr`
- [x] It doesn't compile
- [ ] `int int int`
::answer
It doesn't compile with GCC or Clang on macOS and Linux: `g(NULL)` is ambiguous, so nothing prints. Without that call it would print `int ptr `.

`g(NULL)` is ambiguous on both GCC and Clang (verified): their `NULL` is the builtin `__null`, which converts to `int` and to `char*` equally well. On an implementation defining `NULL` as plain `0`, it would pick `int`. Either way, `nullptr` avoids the question.
:::

:::predict{#P6}
```cpp
int x = 1, y = 2;
int& r = x;
r = y;
y = 3;
cout << x;
```
::answer
`2`

`r = y` assigns 2 to `x`; references never reseat. Changing `y` afterwards doesn't affect `x`.
:::

:::predict{#P7}
```cpp
int m[2][3];
cout << sizeof(m) << ' ' << sizeof(m[0]) << ' ' << sizeof(m[0][0]);
```
::answer
`24 12 4`

Two rows of three `int`s, one row, one `int`.
:::

:::predict{#P8}
```cpp
int a[5]{};
int* p = a;
cout << (&a[4] - p) << ' '
     << std::is_same_v<decltype(&a), int (*)[5]> << ' '
     << std::is_same_v<decltype(p + 1), int*>;
```
::answer
`4 1 1`

Pointer difference counts elements. `&a` is a pointer to the whole array.
:::
