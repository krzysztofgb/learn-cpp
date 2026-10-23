### From source to binary

1. **Preprocessing:** `#include` pastes files textually, macros expand, conditionals resolve. The result is a *translation unit* (TU).
2. **Compilation:** each TU becomes an object file independently. The compiler sees nothing from other TUs.
3. **Linking:** the linker matches undefined symbols to definitions across object files and libraries.

A header is just text pasted into every TU that includes it. Include guards or `#pragma once` stop double inclusion within one TU, but not across TUs.

> **Coming from Go?** Go compiles a whole package as one unit, with no headers: the compiler sees every file of the package at once. A C++ compiler sees one `.cpp` file plus whatever its `#include`s paste in, and nothing else.

*Further reading:* [Introduction to the compiler, linker, and libraries](https://www.learncpp.com/cpp-tutorial/introduction-to-the-compiler-linker-and-libraries/), [Introduction to the preprocessor](https://www.learncpp.com/cpp-tutorial/introduction-to-the-preprocessor/), [Header files](https://www.learncpp.com/cpp-tutorial/header-files/), [Header guards](https://www.learncpp.com/cpp-tutorial/header-guards/)

### Declarations, definitions and the ODR

A declaration introduces a name and its type; a definition also provides the entity (the function body, the storage). Every definition is also a declaration, and a name may be declared any number of times. The One Definition Rule (\[basic.def.odr\]):

- Non-inline functions and variables: exactly one definition in the whole program (if used).
- Classes, enums, templates, inline functions and inline variables: one definition per TU that uses them, and all definitions must be token-for-token identical with the same meaning.

Breaking the first rule is usually caught by the linker: a non-inline function or variable *defined* in a header that two `.cpp` files include gives a "duplicate symbol" (or "multiple definition") link error, and one that's declared and used but never defined gives "undefined symbol". The fixes are to mark the definition `inline`, or to keep only a declaration in the header (`extern int g_counter;`) and define it in one `.cpp`.

Breaking the second rule is *ill-formed, no diagnostic required*. The linker silently keeps one copy, and inlining can make different call sites use different versions: at `-O0` every call goes to the one surviving out-of-line copy, while at `-O2` each TU may inline its own body.

*Further reading:* [Forward declarations and definitions](https://www.learncpp.com/cpp-tutorial/forward-declarations/), [Programs with multiple code files](https://www.learncpp.com/cpp-tutorial/programs-with-multiple-code-files/)

### Linkage

| Linkage | Visible from | How you get it |
| --- | --- | --- |
| External | Other TUs | Default for functions and non-const globals |
| Internal | This TU only | `static` at namespace scope, anonymous namespace, `const`/`constexpr` namespace-scope variables (unless `extern` or `inline`) |
| None | This scope only | Locals |

`inline` means "identical definitions may appear in multiple TUs", not "please inline this". Since C++17 variables can be `inline` too, which is the standard way to define a global constant in a header: `inline constexpr int kMaxLevels = 64;`. Functions defined inside a class body, `constexpr` functions, and templates are implicitly inline for ODR purposes.

The keyword `static` has three unrelated meanings: internal linkage at namespace scope, static storage duration for locals, and "belongs to the class" for members. A `static` local is initialized once, the first time control passes its declaration (thread-safely since C++11), and keeps its value across calls until the program exits.

An anonymous namespace (`namespace { … }`) gives everything inside it internal linkage, including classes and other types, which `static` can't be applied to. It's the modern way to say "private to this file".

*Further reading:* [Internal linkage](https://www.learncpp.com/cpp-tutorial/internal-linkage/), [External linkage and variable forward declarations](https://www.learncpp.com/cpp-tutorial/external-linkage-and-variable-forward-declarations/), [Inline functions and variables](https://www.learncpp.com/cpp-tutorial/inline-functions-and-variables/), [Sharing global constants across multiple files (using inline variables)](https://www.learncpp.com/cpp-tutorial/sharing-global-constants-across-multiple-files-using-inline-variables/), [Static local variables](https://www.learncpp.com/cpp-tutorial/static-local-variables/), [Unnamed and inline namespaces](https://www.learncpp.com/cpp-tutorial/unnamed-and-inline-namespaces/)

### Name mangling and `extern "C"`

C++ encodes namespaces, classes and parameter types into symbol names so overloads can coexist. To inspect them on macOS and Linux, `nm -C` lists an object file's symbols demangled (`T` is a function defined here with external linkage, `t` one with internal linkage, `U` an undefined symbol the linker must find elsewhere), and `c++filt` demangles a name; on Windows, `dumpbin /SYMBOLS` lists symbols and `undname` demangles MSVC names. Return types are not part of a non-template function's mangled name, so a mismatched return type between declaration and definition links fine and is UB. `extern "C"` disables mangling so C code can call the function, at the price of no overloading. C headers meant for both languages wrap their declarations in `#ifdef __cplusplus` / `extern "C" {` … `}`.

*Further reading:* [Language linkage](https://en.cppreference.com/w/cpp/language/language_linkage)

### Why templates live in headers

A template is instantiated in the TU that uses it, so its full definition must be visible there. Alternatives: explicit instantiation in one `.cpp` (`template class Ring<int>;`) plus `extern template class Ring<int>;` in the header, which also cuts compile time. Only the instantiated types work then; any other `T` fails at link time.

*Further reading:* [Using function templates in multiple files](https://www.learncpp.com/cpp-tutorial/using-function-templates-in-multiple-files/)

### Name lookup and ADL

Unqualified lookup searches outward through enclosing scopes and stops at the first scope that has the name. That's why a derived class's `f(double)` *hides* every base-class `f`, even ones with better-matching signatures. Bring them back with `using Base::f;`.

*Argument-dependent lookup* (ADL) adds the namespaces of the argument types to the search for unqualified function calls. It's why `std::cout << x` finds `std::operator<<`, and why generic code writes `using std::swap; swap(a, b);`: the user's own `swap` in their namespace wins via ADL, with `std::swap` as the fallback. A qualified call such as `std::swap(a, b)` turns ADL off, so it always uses the generic three-move version and silently skips a type's cheaper custom `swap`.

C++20's *customization point objects* (`std::ranges::swap`, `std::ranges::begin`) package that two-step dance: they're `constexpr` function objects, not functions, so ADL never finds an alternative to them, and calling one tries the type's own customization first (a member such as `r.begin()`, or an ADL-found free function such as the user's `swap`), then falls back to a default implementation.

*Further reading:* [Hiding inherited functionality](https://www.learncpp.com/cpp-tutorial/hiding-inherited-functionality/), [Argument-dependent lookup](https://en.cppreference.com/w/cpp/language/adl)

### Overload resolution

Viable candidates are ranked per argument by the conversion needed:

1. Exact match (including array-to-pointer, qualification adjustments)
2. Promotion (`char`→`int`, `float`→`double`, `bool`→`int`)
3. Standard conversion (`int`→`long`, `int`→`double`, `unsigned`→`int`, `double`→`int`, `0` or `nullptr` to a pointer, derived-to-base pointer)
4. User-defined conversion (a non-`explicit` converting constructor or conversion operator; at most one per argument)
5. Ellipsis `...`

A candidate wins if it's at least as good on every argument and better on one. Two candidates in the same rank are ambiguous. A function template takes part with the types deduced from the arguments, so it usually offers an exact match: `template <class T> void g(T)` beats `void g(int)` for an `unsigned` argument, because the non-template needs a conversion. Only when both are equally good does the tie-breaker apply: the non-template wins. `g<>(x)` considers only templates. A deleted function still takes part in overload resolution, so `= delete` on an overload blocks a conversion: `void set_qty(double) = delete;` makes `set_qty(1.5)` a compile error instead of a silent conversion.

Default arguments are bound at compile time from the static type, which matters for virtual functions: a call through a `Base*` uses `Base`'s default value even when it dispatches to `Derived`'s override.

*Further reading:* [Function overload resolution and ambiguous matches](https://www.learncpp.com/cpp-tutorial/function-overload-resolution-and-ambiguous-matches/), [Deleting functions](https://www.learncpp.com/cpp-tutorial/deleting-functions/), [Default arguments](https://www.learncpp.com/cpp-tutorial/default-arguments/), [Function template instantiation](https://www.learncpp.com/cpp-tutorial/function-template-instantiation/)
