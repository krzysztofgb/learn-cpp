:::question{#Q1}
When would you return `std::optional<T>` vs a pointer vs a sentinel value?
::answer
`optional` when absence is a normal outcome and the value is small; a pointer when referring to an existing object that may not exist (non-owning); a sentinel only when a value is naturally impossible and documented.
:::

:::question{#Q2}
How is `std::variant` laid out, and how does `std::visit` dispatch?
::answer
Storage big enough for the largest alternative plus an index, padded. `visit` uses a compile-time generated table or switch indexed by `index()` (for multiple variants, a multidimensional table).
:::

:::question{#Q3}
What does `std::function` cost compared to a template parameter or function pointer?
::answer
Type erasure: an indirect call that can't be inlined, a possible heap allocation for large callables, and a larger object (32 or 48 bytes). A template parameter is fully inlinable; a function pointer is an indirect call without state.
:::

:::question{#Q4}
What is a lambda's closure type? How are captures stored?
::answer
A unique unnamed class type; by-value captures are data members, by-reference captures are references or pointers, and `operator()` is the body.
:::

:::question{#Q5}
What are the dangers of capturing `this`?
::answer
The lambda doesn't keep the object alive. If it runs later (timers, async callbacks, other threads), `this` may dangle. Use `[*this]`, a `weak_ptr`, or guaranteed cancellation.
:::

:::question{#Q6}
`steady_clock` vs `system_clock`: which do you use to measure latency, and why?
::answer
`steady_clock`: monotonic, unaffected by wall-clock adjustments. `system_clock` is for timestamps that must match real time.
:::

:::question{#Q7}
When is `std::any` appropriate?
::answer
Rarely: heterogeneous storage where the set of types is open and unknown at compile time, like generic property bags. Usually `variant` or a proper interface is better.
:::

:::question{#Q8}
What do structured bindings actually bind to?
::answer
To members of one hidden object initialized from the expression (a copy for `auto`, a reference for `auto&`). The names are aliases, not separate variables.
:::

:::question{#Q9}
Why might the same `<random>` code produce different numbers on two machines?
::answer
Engines like `mt19937` are fully specified, but distributions aren't: libc++ and libstdc++ implement them differently. For reproducible simulations, implement the distribution yourself.
:::
