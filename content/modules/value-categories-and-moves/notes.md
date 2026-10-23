### Value categories

Every expression has a type and a value category.

| Category | Has identity? | Can be moved from? | Examples |
| --- | --- | --- | --- |
| lvalue | Yes | Not implicitly | Variable names (even of type `T&&`), `*p`, `a[i]`, `++i`, a call returning `T&`, string literals |
| xvalue | Yes | Yes | `std::move(x)`, a call returning `T&&`, a member of an rvalue (`make().member`) |
| prvalue | No | Initializes an object directly | `42`, `a + b`, `i++`, a call returning `T` by value, a lambda expression, `this` |

*glvalue* = lvalue or xvalue (has identity). *rvalue* = xvalue or prvalue (can be moved from). `decltype((expr))` reveals the category: `T&` for lvalues, `T&&` for xvalues, plain `T` for prvalues.

The conditional operator `c ? a : b` keeps the category when it can \[expr.cond\]: if `a` and `b` are glvalues of the same type and the same category, the result is too (two lvalues give an lvalue you can assign to). If either operand is a prvalue, or the types differ and one must be converted, the result is a prvalue.

**Reference binding** \[dcl.init.ref\] decides which overload an expression picks:

- A non-const lvalue reference `T&` binds only to lvalues.
- An rvalue reference `T&&` binds only to rvalues (xvalues and prvalues).
- `const T&` binds to both, so with overloads for `const T&` and `T&&`, lvalues go to the first and rvalues prefer the second.

What counts is the category of the expression, not the declared type of a variable: a named variable of type `T&&` is an lvalue, so it picks the `T&` overload.

Binding a prvalue directly to a local `const T&` or `T&&` extends the temporary's lifetime to the reference's; binding to a reference that a function returns (including `operator[]` or a getter called on a temporary) extends nothing (:sec[object-lifetime/temporaries-and-lifetime-extension]).

*Further reading:* [Value categories (lvalues and rvalues)](https://www.learncpp.com/cpp-tutorial/value-categories-lvalues-and-rvalues/), [Lvalue references](https://www.learncpp.com/cpp-tutorial/lvalue-references/), [R-value references](https://www.learncpp.com/cpp-tutorial/rvalue-references/)

### Moves

A move constructor `T(T&&) noexcept` steals the source's resources and leaves it in a *valid but unspecified* state: you can destroy it or assign to it, and call member functions without preconditions (like `size()` or `clear()`), but you can't assume its contents. Functions with preconditions (`v[0]`, `front()`) are UB unless you know the state, for example after reassigning. Some types specify more: a moved-from `unique_ptr` is null.

`std::move(x)` is only `static_cast<std::remove_reference_t<decltype(x)>&&>(x)`. It enables a move; the move happens only if some overload taking `T&&` is selected. Moving a `const` object silently copies, because `const T&&` doesn't bind to `T&&` but does bind to `const T&`. And because `std::move` returns a reference, it creates no object and extends no lifetime: a function returning `T&&` (or `T&`) to one of its own locals returns a dangling reference. Return `T` by value.

Declare move operations `noexcept`: `std::vector` reallocation moves elements only if their move constructor can't throw and otherwise copies them (:sec[error-handling/noexcept]). `std::is_nothrow_move_constructible_v<T>` checks it at compile time.

A move assignment operator releases the target's old resource, takes the source's, and leaves the source valid (typically empty). It must also survive self-move, `x = std::move(x)`, which generic code (`swap`, algorithms) can produce through aliasing: if it frees its own resource before reading the source, the object is left pointing at freed memory. Either test `this != &other` first, or implement it as move-and-swap. Standard library types leave a self-moved object valid but unspecified.

*Further reading:* [Move constructors and move assignment](https://www.learncpp.com/cpp-tutorial/move-constructors-and-move-assignment/), [std::move](https://www.learncpp.com/cpp-tutorial/stdmove/)

### Forwarding references and `std::forward`

In `template <class T> void f(T&& x)` and in `auto&& x`, `T&&` is a *forwarding reference*, not an rvalue reference: if you pass an lvalue `int`, `T` deduces to `int&`, and reference collapsing turns `int& &&` into `int&`. If you pass an rvalue, `T` deduces to plain `int` and `x` is an `int&&`. The collapsing rule: any `&` wins; only `&& &&` gives `&&`.

Inside `f`, `x` has a name, so it's an lvalue. `std::forward<T>(x)` casts it back to an rvalue only if an rvalue was passed. Forward each argument at most once; after forwarding, treat it as possibly moved-from.

A parameter pack forwards element by element: `template <class... Args> void emplace(Args&&... args)` passes them on as `T(std::forward<Args>(args)...)`. That's how `make_unique` and `emplace_back` reach the constructor overload (`const std::string&` or `std::string&&`) that a direct call with the same arguments would pick.

`std::forward` needs its template argument spelled out. The argument expression is always an lvalue, so it carries no trace of the original category; only `T` does. Its parameter is `std::remove_reference_t<T>&` (plus an `&&` overload for forwarding rvalues), a non-deduced context, and both overloads return `static_cast<T&&>(x)`, which reference collapsing turns into `T&` or `T&&`. The rvalue overload `static_assert`s that `T` isn't an lvalue reference.

`T&&` is a forwarding reference only when `T` is deduced at that call. `std::vector<T>&&` and `const T&&` are plain rvalue references.

*Further reading:* [std::forward](https://en.cppreference.com/w/cpp/utility/forward)

### Copy elision

- **Guaranteed (C++17):** a prvalue initializes its destination directly. `T x = T();`, `T x = make();` (where `make` returns a prvalue), and `return T{...};` never call a copy or move constructor, which may even be deleted.
- **NRVO (optional):** `T f() { T local; ...; return local; }` usually constructs `local` directly in the caller's storage. Clang and GCC do this when every return returns the same variable.
- **Implicit move:** when NRVO doesn't apply, `return local;` still treats `local` as an rvalue (and C++20/C++23 widened the cases). So `return std::move(local);` is a *pessimization*: it turns a prvalue-like return into an xvalue, disabling NRVO. Clang warns with `-Wpessimizing-move`.

Elision is allowed even when the skipped copy or move constructor has side effects, such as printing, so whether those side effects appear depends on which kind of elision applies.

*Further reading:* [Class initialization and copy elision](https://www.learncpp.com/cpp-tutorial/class-initialization-and-copy-elision/), [Copy elision](https://en.cppreference.com/w/cpp/language/copy_elision)

### Parameter passing

| Intent | Signature |
| --- | --- |
| Read only, cheap to copy (`int`, `string_view`, small structs) | `T` |
| Read only, expensive | `const T&` |
| Modify | `T&` |
| Take ownership / store a copy | `T` by value, then `std::move` into place (one extra move vs two overloads) |
| Generic forwarding | `T&&` + `std::forward` |

With a by-value sink, the parameter is initialized from the argument first (copied from an lvalue, moved from an rvalue, constructed directly from anything else that converts, such as a string literal), then moved into place. The `const T&` plus `T&&` overload pair saves that one move per call at the cost of writing two functions. To count the allocations behind these copies, replace the global `operator new` (:sec[raw-memory/new-is-two-steps]).

Ref-qualified member functions (`auto data() &&`) let a member behave differently on rvalue objects, for example moving out of a temporary.

*Further reading:* [Pass by const lvalue reference](https://www.learncpp.com/cpp-tutorial/pass-by-const-lvalue-reference/)
