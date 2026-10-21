:::exercise{#E1 level=warm-up title="Event visitor"}
Model market events as `std::variant<Add, Cancel, Modify, Trade>` and process a vector of them with `std::visit` and the `overloaded` idiom. Make it a compile error to forget a case.
::hint
A visitor missing an alternative fails to compile with `std::visit`, as long as you don't add a generic `auto` catch-all.
:::

:::exercise{#E2 level=standard title="`Function<R(Args...)>`"}
Implement a type-erased callable with a 32-byte small buffer and heap fallback, supporting copy and move. Compare `sizeof` and call cost against `std::function` and a template parameter in a tight loop.
::hint
Store a pointer to a static "vtable" struct with `invoke`, `copy`, `move` and `destroy` function pointers for the stored type.
:::

:::exercise{#E3 level=standard title="Latency timer"}
Write an RAII `ScopedTimer` that records `steady_clock` elapsed nanoseconds into a fixed array of logarithmic buckets, and a report function printing p50 and p99 estimates with `std::format`.
:::

:::exercise{#E4 level=standard title="`Expected<T, E>`"}
Implement a minimal version with `has_value`, `value` (throws), `error`, `operator*`, `and_then` and `transform`. Keep it allocation-free.
:::

:::exercise{#E5 level=interview-hard title="Two-type variant"}
Implement `Variant2<A, B>` with correct construction, destruction, copy, move, assignment between alternatives, and a `visit`. Then generalize the index dispatch to N types with a fold expression or a function-pointer table.
::hint
For N types, build a `constexpr` array of function pointers indexed by `index()`, one instantiation per alternative.
:::
