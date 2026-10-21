:::question{#Q1}
What is SFINAE? What's the "immediate context"?
::answer
When substituting template arguments makes a declaration invalid, that candidate is dropped instead of causing an error. Only the signature and template parameter defaults are the immediate context; errors in bodies are hard errors.
:::

:::question{#Q2}
`enable_if` vs concepts: what do concepts improve?
::answer
Readable named constraints, clear diagnostics, overloading by constraint with subsumption, and constrained `auto`.
:::

:::question{#Q3}
What is CRTP and when would you use it over virtual functions?
::answer
A base template parameterized on the derived class, giving static dispatch. Use it when the types are known at compile time and the call must be inlined; virtual functions when you need runtime heterogeneity.
:::

:::question{#Q4}
How does deducing `this` change CRTP?
::answer
A non-template base with `this auto& self` deduces the derived type at each call, removing the template parameter, the casts and the misuse risk.
:::

:::question{#Q5}
What is tag dispatch?
::answer
Selecting an overload by passing an empty tag object whose type encodes a property, like iterator categories.
:::

:::question{#Q6}
`constexpr` vs `consteval` vs `constinit`?
::answer
See :mod[types-and-initialization] table 1.8: may run at compile time / must run at compile time / static initialization guaranteed but mutable.
:::

:::question{#Q7}
When do you use `if constexpr` instead of overloading?
::answer
When the variants are small and local to one function, or when branches wouldn't compile for some types. Overloading or concepts scale better for public APIs.
:::

:::question{#Q8}
Explain policy-based design and why it suits low-latency code.
::answer
Behaviors (locking, allocation, logging) are template parameters selected at compile time, so unused features cost nothing and everything inlines.
:::

:::question{#Q9}
How would you implement `std::is_same` and `std::remove_reference`?
::answer
`is_same`: primary `false_type`, partial specialization `<T, T>` is `true_type`. `remove_reference`: primary `type = T`, specializations for `T&` and `T&&` with `type = T`.
:::

:::question{#Q10}
What does `std::declval` do?
::answer
Returns an rvalue reference to `T` for use in unevaluated expressions only, so you can ask about expression validity and types without constructing anything.
:::
