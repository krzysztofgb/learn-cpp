:::exercise{#E1 level=warm-up title="Common type"}
Write `max_of(a, b)` accepting two different arithmetic types and returning `std::common_type_t`. Test with `int`/`double`, `unsigned`/`int` (and note the danger), and `int64_t`/`int32_t`.
::hint
`unsigned` and `int` have common type `unsigned`, so `max_of(-1, 1u)` returns a huge value. Constrain or use `std::cmp_less`.
:::

:::exercise{#E2 level=standard title="`print(args...)`"}
Implement a variadic `print` that separates arguments with ", " using a fold over the comma operator, with no trailing separator. Then a `format_into(buf, args...)` variant that writes into a fixed `char` buffer without allocating.
::hint
`((std::cout << (first ? "" : ", ") << args, first = false), ...);` with `bool first = true;`.
:::

:::exercise{#E3 level=standard title="Type list toolkit"}
Implement `TypeList<Ts...>` with `Length`, `Front`, `PushFront`, `Contains<T>` and `IndexOf<T>` using partial specialization and folds. Test everything with `static_assert`.
:::

:::exercise{#E4 level=standard title="String NTTPs"}
Implement `FixedString<N>` usable as an NTTP (C++20), then `Field<"price", int64_t>` and `Message<Field<...>...>` where `get<"price">(msg)` is resolved at compile time.
:::

:::exercise{#E5 level=interview-hard title="Compile-time dispatch table"}
Given message handlers as types each declaring `static constexpr char type` (like `'A'`, `'E'`, `'X'`), generate a 256-entry `constexpr` array of function pointers from a parameter pack, and dispatch raw bytes by type with one indexed call. Benchmark against a virtual-function design.
::hint
Build the table with an immediately invoked `consteval` lambda that loops over the pack via a fold, assigning `table[Handlers::type] = &Handlers::handle`.
:::

:::exercise{#E6 level=standard title="Compile time"}
Put a heavy template (for example a big `std::variant` visitor) in a header used by 20 TUs. Measure build time, then add explicit instantiation in one TU with `extern template` elsewhere and measure again.
:::
