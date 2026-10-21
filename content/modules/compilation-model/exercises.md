:::exercise{#E1 level=warm-up title="Read the linker"}
Build a three-file project. Deliberately trigger "duplicate symbol" (a non-inline function defined in a header) and "undefined symbol" (declared, never defined). Then inspect symbols with `nm -C` and mark which are external (`T`), internal (`t`) and undefined (`U`).
:::

:::exercise{#E2 level=warm-up title='`extern "C"`'}
Write a C file and a C++ file that call each other. Compare the symbol names with and without `extern "C"`, and demangle them with `c++filt`.
:::

:::exercise{#E3 level=standard title="A live ODR violation"}
Reproduce U3. Call `version()` from both TUs and print the results at `-O0` and at `-O2`. Explain why the output changes with optimization.
::hint
At `-O0` both TUs call the single surviving out-of-line copy. At `-O2` each TU inlines its own body, so the two calls return different values.
:::

:::exercise{#E4 level=standard title="Overload table"}
Declare `f(int)`, `f(long)`, `f(double)`, `f(const char*)` and `f(std::string)`. Predict the result of `f('x')`, `f(1L)`, `f(1u)`, `f(2.0f)`, `f("s")`, `f(std::string_view{"s"})`, `f(nullptr)` and `f(0)`, including compile errors. Verify on both compilers.
::hint
`f('x')` is `int` (promotion). `f(1L)` is `long`. `f(1u)` is ambiguous. `f(2.0f)` is `double`. `f("s")` is `const char*` (exact after decay, beats the user-defined conversion to `std::string`). `f(std::string_view{"s"})` doesn't compile: `string_view` converts to `std::string` only explicitly. `f(nullptr)` is `const char*`. `f(0)` is `int`.
:::

:::exercise{#E5 level=interview-hard title="Customization points"}
Write a generic `swap_all(T& a, T& b)` that correctly picks up a user-provided `swap` for a type in the user's namespace. Then show what goes wrong if you write `std::swap(a, b)` instead. Finally, implement a minimal C++20-style customization point object (a `constexpr` function object) that prefers a member `.swap()`, then ADL `swap`, then moves.
:::
