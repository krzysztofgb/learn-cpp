:::question{#Q1}
Define lvalue, prvalue and xvalue, with an example of each.
::answer
lvalue: has identity, e.g. `x`. xvalue: has identity but is expiring, e.g. `std::move(x)`. prvalue: no identity, initializes an object, e.g. `x + 1`.
:::

:::question{#Q2}
What does `std::move` do? Does it move anything?
::answer
It's an unconditional cast to an rvalue reference. Nothing moves until a move constructor or move assignment is selected.
:::

:::question{#Q3}
What state is an object in after being moved from?
::answer
Valid but unspecified unless the type documents more. You can destroy it, assign to it, and call members without preconditions.
:::

:::question{#Q4}
What's the difference between an rvalue reference and a forwarding reference?
::answer
`T&&` with `T` deduced (or `auto&&`) binds to anything and preserves the category through deduction; otherwise `T&&` binds only to rvalues.
:::

:::question{#Q5}
Explain reference collapsing.
::answer
When references to references form via templates or aliases: `& &`, `& &&` and `&& &` collapse to `&`; `&& &&` collapses to `&&`.
:::

:::question{#Q6}
What is guaranteed copy elision? How is it different from NRVO?
::answer
Since C++17, prvalues initialize their destination directly, with no copy or move constructor needed. NRVO is an optional optimization for named locals.
:::

:::question{#Q7}
Why is `return std::move(local);` usually wrong?
::answer
It turns the return into an xvalue, preventing NRVO; the plain `return local;` already moves implicitly when NRVO doesn't apply.
:::

:::question{#Q8}
Why should move constructors be `noexcept`?
::answer
Containers use moves during reallocation only if they can't throw; otherwise they copy to keep the strong guarantee.
:::

:::question{#Q9}
When should a function take a parameter by value?
::answer
When the function stores or consumes its own copy anyway: callers with rvalues pay a move instead of a copy.
:::

:::question{#Q10}
Can you move from a `const` object?
::answer
No. `std::move` of a `const` object yields `const T&&`, which selects the copy constructor.
:::
