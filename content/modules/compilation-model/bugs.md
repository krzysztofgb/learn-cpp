:::bug{#U1 findings=ub}
Two TUs, each used by the same inline function in a shared header:

```cpp run=none
// a.cpp
struct Config { int x; };
// b.cpp
struct Config { int x; int y; };
```
::answer
UB: an ODR violation, ill-formed with no diagnostic required. Code in each TU assumes a different layout. Use one definition in one header.
:::

:::bug{#U2 findings=compile-error}
A header included by two `.cpp` files:

```cpp run=none
int g_counter = 0;
int square(int x) { return x * x; }
```
::answer
Doesn't build: the linker reports a duplicate symbol for both. (The standard calls this ill-formed, no diagnostic required, but every linker catches duplicate non-inline definitions.) Fix with `inline int g_counter = 0;` (or `extern` in the header and one definition in a `.cpp`) and `inline int square(int)`.
:::

:::bug{#U3 findings=ub}
```cpp run=none
// a.cpp
inline int version() { return 1; }
// b.cpp
inline int version() { return 2; }
```
::answer
UB: an ODR violation, no diagnostic required. The linker keeps one definition, but any call the compiler inlined uses its own TU's body, so results vary by optimization level.
:::

:::bug{#U4 findings=ub}
```cpp run=none
// a.cpp
extern int scale(int);
int use() { return scale(3); }
// b.cpp
double scale(int x) { return x * 1.5; }
```
::answer
UB. Return types aren't mangled for non-template functions, so this links, and `use()` reads an `int` from where a `double` was returned.
:::

:::bug{#U5 findings=defined-bug}
A header:

```cpp
const std::string kVenue = "XNAS";
```
::answer
A defined bug, not UB: namespace-scope `const` has internal linkage, so each TU gets its own string. It wastes memory, runs a constructor per TU at startup, and joins the static init order fiasco (:mod[object-lifetime]). Prefer `inline constexpr std::string_view kVenue = "XNAS";`.
:::
