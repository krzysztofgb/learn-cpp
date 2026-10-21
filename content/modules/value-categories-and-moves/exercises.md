:::exercise{#E1 level=warm-up title="Category probe"}
Write `template <class T> constexpr const char* category = "prvalue";` with specializations for `T&` (lvalue) and `T&&` (xvalue), and a macro `CAT(e)` using `category<decltype((e))>`. Classify 15 expressions, including `x`, `std::move(x)`, `x++`, `++x`, `"lit"`, `make().member`, `arr[0]`, a ternary of two lvalues, and a ternary of an lvalue and a prvalue.
::hint
A ternary of two lvalues of the same type is an lvalue; with a prvalue operand it's a prvalue. `x++` is a prvalue; `++x` is an lvalue.
:::

:::exercise{#E2 level=standard title="Movable `Buffer`"}
Implement a heap-backed `Buffer` with copy and move operations. Verify `std::is_nothrow_move_constructible_v`, then count copies during `std::vector<Buffer>` growth with and without `noexcept`.
:::

:::exercise{#E3 level=standard title="`my_make_unique`"}
Implement `template <class T, class... Args> std::unique_ptr<T> my_make_unique(Args&&... args)` with perfect forwarding. Test with a type whose constructor has separate `const std::string&` and `std::string&&` overloads that print which one ran.
:::

:::exercise{#E4 level=standard title="Sink parameters"}
For a `setName` member, implement (a) `const std::string&` only, (b) by-value plus `std::move`, (c) `const&` and `&&` overloads. Count allocations with a replaced global `operator new` for lvalue, rvalue and string-literal arguments, and fill in a table.
::hint
By-value plus move: lvalue = 1 copy, rvalue = 0 copies (2 moves total), literal = 1 construction. Overloads save one move per call; by-value saves code.
:::

:::exercise{#E5 level=interview-hard title="Implement `move` and `forward`"}
Write `my_move` and `my_forward` (both overloads of `forward`). Explain why `forward` requires an explicit template argument, and add `static_assert` tests for each combination of argument category and `T`.
::hint
`forward` must know the original type, which can't be deduced from the now-lvalue argument. Hence `std::forward<T>(x)`.
:::
