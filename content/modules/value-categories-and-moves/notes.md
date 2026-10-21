### Value categories

Every expression has a type and a value category.

| Category | Has identity? | Can be moved from? | Examples |
| --- | --- | --- | --- |
| lvalue | Yes | Not implicitly | Variable names (even of type `T&&`), `*p`, `a[i]`, `++i`, a call returning `T&`, string literals |
| xvalue | Yes | Yes | `std::move(x)`, a call returning `T&&`, a member of an rvalue (`make().member`) |
| prvalue | No | Initializes an object directly | `42`, `a + b`, `i++`, a call returning `T` by value, a lambda expression, `this` |

*glvalue* = lvalue or xvalue (has identity). *rvalue* = xvalue or prvalue (can be moved from). `decltype((expr))` reveals the category: `T&` for lvalues, `T&&` for xvalues, plain `T` for prvalues.

### Moves

A move constructor `T(T&&) noexcept` steals the source's resources and leaves it in a *valid but unspecified* state: you can destroy it or assign to it, and call member functions without preconditions (like `size()` or `clear()`), but you can't assume its contents. Some types specify more: a moved-from `unique_ptr` is null.

`std::move(x)` is only `static_cast<std::remove_reference_t<decltype(x)>&&>(x)`. It enables a move; the move happens only if some overload taking `T&&` is selected. Moving a `const` object silently copies, because `const T&&` doesn't bind to `T&&` but does bind to `const T&`.

### Forwarding references and `std::forward`

In `template <class T> void f(T&& x)` and in `auto&& x`, `T&&` is a *forwarding reference*, not an rvalue reference: if you pass an lvalue `int`, `T` deduces to `int&`, and reference collapsing turns `int& &&` into `int&`. The collapsing rule: any `&` wins; only `&& &&` gives `&&`.

Inside `f`, `x` has a name, so it's an lvalue. `std::forward<T>(x)` casts it back to an rvalue only if an rvalue was passed. Forward each argument at most once; after forwarding, treat it as possibly moved-from.

`T&&` is a forwarding reference only when `T` is deduced at that call. `std::vector<T>&&` and `const T&&` are plain rvalue references.

### Copy elision

- **Guaranteed (C++17):** a prvalue initializes its destination directly. `T x = T();`, `T x = make();` (where `make` returns a prvalue), and `return T{...};` never call a copy or move constructor, which may even be deleted.
- **NRVO (optional):** `T f() { T local; ...; return local; }` usually constructs `local` directly in the caller's storage. Clang and GCC do this when every return returns the same variable.
- **Implicit move:** when NRVO doesn't apply, `return local;` still treats `local` as an rvalue (and C++20/C++23 widened the cases). So `return std::move(local);` is a *pessimization*: it turns a prvalue-like return into an xvalue, disabling NRVO. Clang warns with `-Wpessimizing-move`.

### Parameter passing

| Intent | Signature |
| --- | --- |
| Read only, cheap to copy (`int`, `string_view`, small structs) | `T` |
| Read only, expensive | `const T&` |
| Modify | `T&` |
| Take ownership / store a copy | `T` by value, then `std::move` into place (one extra move vs two overloads) |
| Generic forwarding | `T&&` + `std::forward` |

Ref-qualified member functions (`auto data() &&`) let a member behave differently on rvalue objects, for example moving out of a temporary.
