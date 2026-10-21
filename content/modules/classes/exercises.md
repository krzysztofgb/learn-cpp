:::exercise{#E1 level=warm-up title="Noisy class"}
Write `Noisy`, which prints from all six special members. Write 10 statements (pass by value, return by value, `std::vector::push_back` with and without `reserve`, `std::swap`) and predict the output before running.
::hint
`push_back` without `reserve` reallocates and copies the existing elements unless the move constructor is `noexcept` (:mod[error-handling]).
:::

:::exercise{#E2 level=standard title="`String` by hand"}
Implement an owning `String` with a heap buffer: all five special members, copy-and-swap assignment, `noexcept` move, `size`, `c_str` and `operator+=`. Test self-assignment and self-move under ASan.
:::

:::exercise{#E3 level=standard title="`Price` type"}
Implement `Price` holding `int64_t` ticks: `explicit` constructor, defaulted `<=>`, `+`, `-` and `*` by an integer as hidden friends, and `std::formatter` support so `std::format("{}", p)` prints a decimal string. Ensure `Price + int` doesn't compile.
:::

:::exercise{#E4 level=standard title="Special member detective"}
For six class definitions (a `unique_ptr` member, a user destructor, a user copy constructor, a `const` member, a reference member, a user move constructor), predict `is_default_constructible`, `is_copy_constructible`, `is_copy_assignable`, `is_move_constructible` and `is_nothrow_move_constructible`. Verify each with `static_assert`.
::hint
A reference or `const` member deletes copy and move *assignment* but not construction. A user copy constructor means no implicit move, but the type still reports move-constructible because `T&&` binds to `const T&`.
:::

:::exercise{#E5 level=interview-hard title="Deduplicated accessors"}
Write a `Grid` class with `operator[](std::size_t r, std::size_t c)` (C++23 multidimensional subscript). Provide the `const` and non-`const` versions with one function body using deducing `this`, then compare with the classic `const_cast` trick.
:::
