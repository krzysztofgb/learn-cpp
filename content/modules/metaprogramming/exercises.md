:::exercise{#E1 level=warm-up title="Traits by hand"}
Implement `is_same`, `remove_reference`, `remove_cv`, `conditional`, `is_pointer` and `decay` (simplified), each with `static_assert` tests mirroring the standard versions.
::hint
`decay` is `remove_reference`, then: arrays become pointers, functions become function pointers, otherwise `remove_cv`.
:::

:::exercise{#E2 level=standard title="Detection three ways"}
Detect whether a type has `reserve(size_t)` with `void_t`, with a trailing `decltype` overload, and with a `requires` expression. Use it in `append_all(container, range)` that reserves only when possible.
:::

:::exercise{#E3 level=standard title="Handler interface"}
Define the `MarketDataHandler` concept from :sec[metaprogramming/concepts-c-20], then implement a dispatcher that accepts any conforming handler, once with CRTP and once with deducing `this`. Make a non-conforming handler fail with a readable error. Compare the assembly of a dispatch call against a virtual version.
::hint
Both CRTP and deducing `this` produce a direct, inlinable call; the virtual version has a load and an indirect call.
:::

:::exercise{#E4 level=standard title="Policies"}
Implement `Logger<SinkPolicy, LockPolicy>` with `StdoutSink`/`BufferSink` and `NullLock`/`MutexLock`. Show on Compiler Explorer that `NullLock` leaves no trace in the generated code.
:::

:::exercise{#E5 level=interview-hard title="Compile-time tables"}
Generate a CRC32 table with a `constexpr` function, then write a `consteval` parser that turns a string like `"35=D|49=SNDR|56=TRGT"` into a `std::array` of (tag, value) pairs at compile time, verified with `static_assert`.
::hint
In a `consteval` function you can use a local `std::array` and loops; return the array by value.
:::

:::exercise{#E6 level=interview-hard title="Tuple algorithms"}
Implement `tuple_for_each(t, f)` and `tuple_transform(t, f)` using `std::index_sequence` and a fold, then rewrite them with C++26 structured binding packs if your compiler supports them.
:::
