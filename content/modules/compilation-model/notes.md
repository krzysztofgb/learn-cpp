### From source to binary

1. **Preprocessing:** `#include` pastes files textually, macros expand, conditionals resolve. The result is a *translation unit* (TU).
2. **Compilation:** each TU becomes an object file independently. The compiler sees nothing from other TUs.
3. **Linking:** the linker matches undefined symbols to definitions across object files and libraries.

A header is just text pasted into every TU that includes it. Include guards or `#pragma once` stop double inclusion within one TU, but not across TUs.

### Declarations, definitions and the ODR

A declaration introduces a name; a definition also provides the entity (the function body, the storage). The One Definition Rule:

- Non-inline functions and variables: exactly one definition in the whole program (if used).
- Classes, enums, templates, inline functions and inline variables: one definition per TU that uses them, and all definitions must be token-for-token identical with the same meaning.

Breaking the second rule is *ill-formed, no diagnostic required*. The linker silently keeps one copy, and inlining can make different call sites use different versions.

### Linkage

| Linkage | Visible from | How you get it |
| --- | --- | --- |
| External | Other TUs | Default for functions and non-const globals |
| Internal | This TU only | `static` at namespace scope, anonymous namespace, `const`/`constexpr` namespace-scope variables (unless `extern` or `inline`) |
| None | This scope only | Locals |

`inline` means "identical definitions may appear in multiple TUs", not "please inline this". Since C++17 variables can be `inline` too, which is the standard way to define a global constant in a header: `inline constexpr int kMaxLevels = 64;`. Functions defined inside a class body, `constexpr` functions, and templates are implicitly inline for ODR purposes.

The keyword `static` has three unrelated meanings: internal linkage at namespace scope, static storage duration for locals, and "belongs to the class" for members.

### Name mangling and `extern "C"`

C++ encodes namespaces, classes and parameter types into symbol names so overloads can coexist; `c++filt` and `nm -C` demangle them. Return types are not part of a non-template function's mangled name, so a mismatched return type between declaration and definition links fine and is UB. `extern "C"` disables mangling so C code can call the function, at the price of no overloading.

### Why templates live in headers

A template is instantiated in the TU that uses it, so its full definition must be visible there. Alternatives: explicit instantiation in one `.cpp` (`template class Ring<int>;`) plus `extern template class Ring<int>;` in the header, which also cuts compile time.

### Name lookup and ADL

Unqualified lookup searches outward through enclosing scopes and stops at the first scope that has the name. That's why a derived class's `f(double)` *hides* every base-class `f`, even ones with better-matching signatures. Bring them back with `using Base::f;`.

*Argument-dependent lookup* (ADL) adds the namespaces of the argument types to the search for unqualified function calls. It's why `std::cout << x` finds `std::operator<<`, and why generic code writes `using std::swap; swap(a, b);`: the user's own `swap` in their namespace wins via ADL, with `std::swap` as the fallback.

### Overload resolution

Viable candidates are ranked per argument by the conversion needed:

1. Exact match (including array-to-pointer, qualification adjustments)
2. Promotion (`char`→`int`, `float`→`double`, `bool`→`int`)
3. Standard conversion (`int`→`long`, `int`→`double`, `double`→`int`, derived-to-base pointer)
4. User-defined conversion (converting constructor or conversion operator)
5. Ellipsis `...`

A candidate wins if it's at least as good on every argument and better on one. Two candidates in the same rank are ambiguous. Ties between a template and a non-template prefer the non-template. `= delete` on an overload blocks a conversion: `void set_qty(double) = delete;`.

Default arguments are bound at compile time from the static type, which matters for virtual functions.
