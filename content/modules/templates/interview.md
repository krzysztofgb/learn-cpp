:::question{#Q1}
How does template argument deduction work for `T`, `T&` and `T&&` parameters?
::answer
See table 14.2: by value decays and strips top-level cv; `T&` preserves cv and arrays; `T&&` deduces `U&` for lvalues and `U` for rvalues. No implicit conversions during deduction.
:::

:::question{#Q2}
Why can't you partially specialize a function template? What do you do instead?
::answer
The language doesn't allow it. Use overloading, or delegate to a class template that can be partially specialized, or `if constexpr`/concepts.
:::

:::question{#Q3}
What's the difference between specializing and overloading a function template?
::answer
Overloads compete in resolution. A specialization doesn't compete; it's only used if its primary template wins, which leads to surprises like P2b.
:::

:::question{#Q4}
Explain two-phase lookup and why `typename` and `this->` are sometimes needed.
::answer
Non-dependent names bind at definition, dependent names at instantiation. The compiler can't know whether `T::x` is a type or value, so `typename` says it's a type, and it doesn't search dependent bases without `this->`.
:::

:::question{#Q5}
Why do templates usually live in headers?
::answer
The full definition is needed wherever it's instantiated. Explicit instantiation lets you move definitions to a `.cpp` for a fixed set of types.
:::

:::question{#Q6}
How do you reduce template code bloat and compile times?
::answer
Hoist type-independent code into non-template helpers, use type erasure at boundaries, explicit instantiation with `extern template`, fewer heavy headers, modules.
:::

:::question{#Q7}
What are fold expressions? Give a unary and a binary example.
::answer
Expansions of a pack over a binary operator. Unary: `(args && ...)`. Binary: `(args + ... + 0)`, which handles empty packs.
:::

:::question{#Q8}
What's new about NTTPs in C++20?
::answer
Floating-point values and structural class types (all-public, constexpr-constructible) can be template arguments, enabling compile-time strings and configuration objects.
:::

:::question{#Q9}
What is CTAD, and what's a deduction guide?
::answer
Deducing class template arguments from constructor arguments. A deduction guide maps constructor argument types to template arguments, e.g. iterator pairs to the element type.
:::

:::question{#Q10}
Compare C++ templates with Go generics.
::answer
C++ instantiates a separate copy per type (fast, inlinable, bigger binaries, slower builds) and type-checks at instantiation (concepts add earlier checks). Go type-checks generics up front and shares code across types with the same GC shape, passing a dictionary, which is smaller but often slower.
:::
