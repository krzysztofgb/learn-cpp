:::question{#Q1}
What are the differences between a pointer and a reference? When do you use each?
::answer
See table 2.1. A reference is an alias that must be bound at initialization and can't be null or reseated; a pointer is an object holding an address. Use references for required parameters, pointers for optional or reseatable ones.
:::

:::question{#Q2}
What is array decay, and how do you pass an array to a function without losing its size?
::answer
In most expressions an array converts to a pointer to its first element and loses its size. Pass by reference to array (`T (&)[N]` in a template), use `std::span`, or use `std::array`.
:::

:::question{#Q3}
Explain `const int*`, `int* const` and `const int* const`.
::answer
Pointer to const `int`; const pointer to mutable `int`; const pointer to const `int`. Read right to left.
:::

:::question{#Q4}
Why use `nullptr` instead of `NULL` or `0`?
::answer
`nullptr` has its own type and only converts to pointers, so overload resolution and templates behave predictably. `NULL` is an integer constant in disguise.
:::

:::question{#Q5}
Is `a[i]` the same as `*(a + i)`? What does that imply about `i[a]`?
::answer
Yes, by definition. Since addition commutes, `i[a]` is `*(i + a)`, which is legal but only good for trivia.
:::

:::question{#Q6}
Can you have an array of references? A pointer to a reference? A reference to a pointer?
::answer
No, no, and yes: `int*& r = p;` is a reference to a pointer.
:::

:::question{#Q7}
Why does `std::set<T*>` use `std::less` instead of the raw `<` operator?
::answer
`<` between pointers into different objects gives unspecified results. `std::less<T*>` is required to give a strict total order consistent across all pointers.
:::

:::question{#Q8}
What is the one-past-the-end pointer, and why is forming it allowed but forming two-past-the-end is not?
::answer
It's the end iterator of a range, so algorithms need to form it. The standard allows forming it but not dereferencing it. Anything beyond is UB to form, partly because on segmented architectures the address might not be representable.
:::

:::question{#Q9}
What's the type of a string literal, and why can't you modify it?
::answer
`const char[N]`, including the terminating zero, with static storage. It may live in read-only memory and may be shared with identical literals, so writes are UB.
:::
