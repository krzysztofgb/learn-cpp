:::exercise{#E1 level=warm-up title="`array_size`"}
Write `template <class T, std::size_t N> constexpr std::size_t array_size(T (&)[N]) noexcept`. Show that it rejects a pointer at compile time while `sizeof(a) / sizeof(a[0])` silently gives a wrong answer.
:::

:::exercise{#E2 level=warm-up title="Declaration drills"}
Write, without aliases, then with `using`: a pointer to an array of 5 `int`; an array of 5 pointers to `int`; a pointer to a function taking `int` and returning a pointer to `char`; an array of 3 such function pointers. Check each with `static_assert` and `std::is_same_v`.
:::

:::exercise{#E3 level=standard title="`memcpy` and `memmove`"}
Implement `my_memcpy` and `my_memmove` over `unsigned char`. `my_memmove` must handle overlap in both directions. Comparing the two pointers with `<` is unspecified for unrelated buffers, so use `std::less` or compare `std::uintptr_t` values, and explain why.
::hint
If the destination starts after the source and the ranges overlap, copy backwards. `std::less<>{}(dst, src)` is guaranteed to be consistent even for unrelated pointers.
:::

:::exercise{#E4 level=standard title="Row-major matrix"}
Implement `Matrix` storing `rows * cols` doubles in one `std::vector`, with `operator()(r, c)`. Time row-order vs column-order traversal of a 4096×4096 matrix and explain the gap (:mod[hardware] explains it fully).
:::

:::exercise{#E5 level=interview-hard title="`ArrayView<T>`"}
Implement a non-owning view like `std::span<T>`: constructible from a C array, `std::array` and `std::vector`, with `size`, unchecked `operator[]`, bounds-checked `at`, `subview(offset, count)`, and iterators. Make the C-array constructor deduce `N`. Write tests that catch an out-of-range `subview` under ASan.
::hint
Deduce `N` with a constructor template `template <std::size_t N> ArrayView(T (&a)[N])`. Use `assert` in `subview` and let ASan catch the rest.
:::
