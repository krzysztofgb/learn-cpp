# Module 3: The compilation model

Go compiles packages as units and has no headers. C++ compiles each source file separately and stitches them together at link time, which creates a class of bugs (ODR violations) that the compiler is not required to diagnose.

## Notes

### 3.1 From source to binary

1. **Preprocessing:** `#include` pastes files textually, macros expand, conditionals resolve. The result is a *translation unit* (TU).
2. **Compilation:** each TU becomes an object file independently. The compiler sees nothing from other TUs.
3. **Linking:** the linker matches undefined symbols to definitions across object files and libraries.

A header is just text pasted into every TU that includes it. Include guards or `#pragma once` stop double inclusion within one TU, but not across TUs.

### 3.2 Declarations, definitions and the ODR

A declaration introduces a name; a definition also provides the entity (the function body, the storage). The One Definition Rule:

- Non-inline functions and variables: exactly one definition in the whole program (if used).
- Classes, enums, templates, inline functions and inline variables: one definition per TU that uses them, and all definitions must be token-for-token identical with the same meaning.

Breaking the second rule is *ill-formed, no diagnostic required*. The linker silently keeps one copy, and inlining can make different call sites use different versions.

### 3.3 Linkage

| Linkage | Visible from | How you get it |
| --- | --- | --- |
| External | Other TUs | Default for functions and non-const globals |
| Internal | This TU only | `static` at namespace scope, anonymous namespace, `const`/`constexpr` namespace-scope variables (unless `extern` or `inline`) |
| None | This scope only | Locals |

`inline` means "identical definitions may appear in multiple TUs", not "please inline this". Since C++17 variables can be `inline` too, which is the standard way to define a global constant in a header: `inline constexpr int kMaxLevels = 64;`. Functions defined inside a class body, `constexpr` functions, and templates are implicitly inline for ODR purposes.

The keyword `static` has three unrelated meanings: internal linkage at namespace scope, static storage duration for locals, and "belongs to the class" for members.

### 3.4 Name mangling and `extern "C"`

C++ encodes namespaces, classes and parameter types into symbol names so overloads can coexist; `c++filt` and `nm -C` demangle them. Return types are not part of a non-template function's mangled name, so a mismatched return type between declaration and definition links fine and is UB. `extern "C"` disables mangling so C code can call the function, at the price of no overloading.

### 3.5 Why templates live in headers

A template is instantiated in the TU that uses it, so its full definition must be visible there. Alternatives: explicit instantiation in one `.cpp` (`template class Ring<int>;`) plus `extern template class Ring<int>;` in the header, which also cuts compile time.

### 3.6 Name lookup and ADL

Unqualified lookup searches outward through enclosing scopes and stops at the first scope that has the name. That's why a derived class's `f(double)` *hides* every base-class `f`, even ones with better-matching signatures. Bring them back with `using Base::f;`.

*Argument-dependent lookup* (ADL) adds the namespaces of the argument types to the search for unqualified function calls. It's why `std::cout << x` finds `std::operator<<`, and why generic code writes `using std::swap; swap(a, b);`: the user's own `swap` in their namespace wins via ADL, with `std::swap` as the fallback.

### 3.7 Overload resolution

Viable candidates are ranked per argument by the conversion needed:

1. Exact match (including array-to-pointer, qualification adjustments)
2. Promotion (`char`→`int`, `float`→`double`, `bool`→`int`)
3. Standard conversion (`int`→`long`, `int`→`double`, `double`→`int`, derived-to-base pointer)
4. User-defined conversion (converting constructor or conversion operator)
5. Ellipsis `...`

A candidate wins if it's at least as good on every argument and better on one. Two candidates in the same rank are ambiguous. Ties between a template and a non-template prefer the non-template. `= delete` on an overload blocks a conversion: `void set_qty(double) = delete;`.

Default arguments are bound at compile time from the static type, which matters for virtual functions.

## Predict the output

**P1**

```cpp kind=fragment run=local
void f(long)   { cout << "long"; }
void f(double) { cout << "double"; }
f(1);
```

**P2**

```cpp kind=fragment run=local
void f(int)    { cout << "int "; }
void f(double) { cout << "double "; }
f('a'); f(1.0f);
```

**P3**

```cpp kind=fragment run=local
struct B { void f(int)    { cout << "B::f(int)"; } };
struct D : B { void f(double) { cout << "D::f(double)"; } };
D d; d.f(1);
```

**P4**

```cpp kind=fragment run=local
template <class T> void g(T) { cout << "T "; }
void g(int) { cout << "int "; }
g(1); g(1u); g<>(1);
```

**P5**

```cpp kind=fragment run=local
struct B { virtual void f(int x = 1) { cout << "B" << x; } };
struct D : B { void f(int x = 2) override { cout << "D" << x; } };
B* p = new D;
p->f();
```

**P6**

```cpp kind=fragment run=local
namespace lib {
    struct Px {};
    void print(Px) { cout << "lib"; }
}
void print(...) { cout << "global"; }
// in main:
lib::Px p; print(p);
```

**P7**

```cpp kind=fragment run=local
int counter() { static int n = 0; return ++n; }
cout << counter() << counter() << counter();
```

## Spot the UB (or the link error)

**U1** Two TUs, each used by the same inline function in a shared header:

```cpp kind=fragment run=local
// a.cpp
struct Config { int x; };
// b.cpp
struct Config { int x; int y; };
```

**U2** A header included by two `.cpp` files:

```cpp kind=fragment run=local
int g_counter = 0;
int square(int x) { return x * x; }
```

**U3**

```cpp kind=fragment run=none
// a.cpp
inline int version() { return 1; }
// b.cpp
inline int version() { return 2; }
```

**U4**

```cpp kind=fragment run=none
// a.cpp
extern int scale(int);
int use() { return scale(3); }
// b.cpp
double scale(int x) { return x * 1.5; }
```

**U5** A header:

```cpp kind=fragment run=local
const std::string kVenue = "XNAS";
```

## Exercises

**E1 ★ Read the linker.** Build a three-file project. Deliberately trigger "duplicate symbol" (a non-inline function defined in a header) and "undefined symbol" (declared, never defined). Then inspect symbols with `nm -C` and mark which are external (`T`), internal (`t`) and undefined (`U`).

**E2 ★ `extern "C"`.** Write a C file and a C++ file that call each other. Compare the symbol names with and without `extern "C"`, and demangle them with `c++filt`.

**E3 ★★ A live ODR violation.** Reproduce U3. Call `version()` from both TUs and print the results at `-O0` and at `-O2`. Explain why the output changes with optimization.

**E4 ★★ Overload table.** Declare `f(int)`, `f(long)`, `f(double)`, `f(const char*)` and `f(std::string)`. Predict the result of `f('x')`, `f(1L)`, `f(1u)`, `f(2.0f)`, `f("s")`, `f(std::string_view{"s"})`, `f(nullptr)` and `f(0)`, including compile errors. Verify on both compilers.

**E5 ★★★ Customization points.** Write a generic `swap_all(T& a, T& b)` that correctly picks up a user-provided `swap` for a type in the user's namespace. Then show what goes wrong if you write `std::swap(a, b)` instead. Finally, implement a minimal C++20-style customization point object (a `constexpr` function object) that prefers a member `.swap()`, then ADL `swap`, then moves.

## Interview questions

1. What's the difference between a declaration and a definition?
2. What is the One Definition Rule? What happens if you violate it?
3. What does `inline` actually mean in modern C++?
4. List the meanings of `static`.
5. Anonymous namespace vs `static` at namespace scope: is there a difference?
6. What is ADL, and why does it exist?
7. Why do templates usually live in headers? How can you avoid it?
8. What is name mangling, and what does `extern "C"` do?
9. Why does generic code write `using std::swap; swap(a, b);`?
10. A derived class declares `f(double)` and you call `d.f(1)` where the base has `f(int)`. Which runs, and how do you change that?
11. Why are default arguments on virtual functions a trap?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | Doesn't compile | `int`→`long` and `int`→`double` are both standard conversions, so the call is ambiguous. |
| P2 | ` int double  ` | `char`→`int` and `float`→`double` are promotions, which beat conversions. |
| P3 | `D::f(double)` | `D::f` hides `B::f`; lookup stops in `D` before overload resolution. |
| P4 | ` int T T  ` | Exact non-template beats template. `1u` makes `T = unsigned` an exact match, better than the `unsigned`→`int` conversion. `g<>` forces a template. |
| P5 | `D1` | Dispatch is dynamic, but the default argument comes from the static type `B`. |
| P6 | `lib` | ADL finds `lib::print`, an exact match that beats the ellipsis. |
| P7 | `123` | Since C++17, `<<` operands evaluate left to right. The local static persists across calls. |

### Spot the UB

- **U1:** ODR violation, ill-formed with no diagnostic required. Code in each TU assumes a different layout. Use one definition in one header.
- **U2:** Link error (duplicate symbol) for both, not UB. Fix with `inline int g_counter = 0;` (or `extern` in the header and one definition in a `.cpp`) and `inline int square(int)`.
- **U3:** ODR violation, no diagnostic required. The linker keeps one definition, but any call the compiler inlined uses its own TU's body, so results vary by optimization level.
- **U4:** UB. Return types aren't mangled for non-template functions, so this links, and `use()` reads an `int` from where a `double` was returned.
- **U5:** Not UB: namespace-scope `const` has internal linkage, so each TU gets its own string. It wastes memory, runs a constructor per TU at startup, and joins the static init order fiasco (Module 5). Prefer `inline constexpr std::string_view kVenue = "XNAS";`.

### Exercise hints

- **E3:** At `-O0` both TUs call the single surviving out-of-line copy. At `-O2` each TU inlines its own body, so the two calls return different values.
- **E4:** `f('x')` is `int` (promotion). `f(1L)` is `long`. `f(1u)` is ambiguous. `f(2.0f)` is `double`. `f("s")` is `const char*` (exact after decay, beats the user-defined conversion to `std::string`). `f(std::string_view{"s"})` doesn't compile: `string_view` converts to `std::string` only explicitly. `f(nullptr)` is `const char*`. `f(0)` is `int`.

### Interview questions

1. A declaration introduces a name and type; a definition also creates the entity (allocates storage or provides the body). Every definition is a declaration.
2. One definition per program for non-inline functions and variables; identical definitions per TU for classes, templates and inline entities. Violations are ill-formed with no diagnostic required, so the program silently misbehaves.
3. Multiple identical definitions are allowed across TUs. Whether a call is actually inlined is the optimizer's decision and unrelated.
4. Internal linkage at namespace scope; static storage for a local (initialized once, thread-safely); class member shared by all instances.
5. Both give internal linkage. The anonymous namespace also works for types and is the modern style.
6. It extends unqualified function lookup to the namespaces of the argument types, so operators and customization functions defined next to a type are found without qualification.
7. Instantiation needs the full definition in the using TU. Explicit instantiation for a known set of types, with `extern template` declarations, avoids it.
8. Encoding namespaces and parameter types into symbol names to support overloading. `extern "C"` uses plain C names for interop.
9. ADL finds a type-specific `swap` if one exists in the type's namespace, and `std::swap` is the fallback. Calling `std::swap` directly skips the custom one.
10. `D::f(double)` runs because name lookup stops at `D`. Add `using B::f;` in `D` to bring `B::f(int)` into overload resolution.
11. The default comes from the static type while the body comes from the dynamic type, so a call through a base pointer mixes the base's default with the derived body.
