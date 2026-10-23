:::exercise{#E1 level=warm-up title="Lifetime tracer"}
Using `M`, predict and verify the output for: returning by value, passing by value, `std::vector<M>` growth, `std::optional<M>` reset, a temporary bound to `const M&`, and a ternary expression mixing a named object and a temporary.
::hint
A ternary with a named lvalue and a temporary produces a prvalue, so it copies the named object.
:::

:::exercise{#E2 level=standard title="`defer`"}
Implement a `ScopeGuard` that runs a callable when the enclosing scope exits (a *defer*: cleanup code written next to the acquisition but run at scope exit), with `dismiss()` and a `noexcept` destructor. Add a `DEFER(...)` macro creating a uniquely named guard. Use it to close a file descriptor on every path of a function with three early returns.

> **Coming from Go?** This is Go's `defer`, except that it runs at the end of the enclosing block rather than at function return.
::hint
Make `ScopeGuard` move-only, and in the destructor call the function only if not dismissed. For unique names, paste `__LINE__` or `__COUNTER__` with a two-level macro.
:::

:::exercise{#E3 level=standard title="The fiasco, live"}
Reproduce U3 across two TUs. Change the link order to change the outcome. Then fix it three ways: a function-local static, `constinit` with a `constexpr` constructor type, and `inline constexpr std::string_view`.
::hint
`constinit` requires a constant initializer, so it fails to compile with `std::string` concatenation, which is the point: it turns the hazard into an error.
:::

:::exercise{#E4 level=standard title="`UniqueFd`"}
Write a move-only RAII wrapper for a POSIX file descriptor with `release`, `reset` and `get`. Moved-from objects hold -1. Prove with a test that no descriptor leaks when a function throws midway. (On Windows, wrap a `HANDLE` closed with `CloseHandle` instead, with `INVALID_HANDLE_VALUE` as the empty state, or use the CRT's `_open` and `_close`.)
:::

:::exercise{#E5 level=interview-hard title="Let the compiler find dangling"}
Annotate `name()` from :mod[classes] U3 and a `max`-like function with `[[clang::lifetimebound]]`. Show that Clang now warns on the dangling uses in U1 and :mod[classes] U3, and check what `-Wdangling` and `-Wdangling-gsl` catch without annotations.
:::
