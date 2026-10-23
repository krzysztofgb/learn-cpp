:::question{#Q1}
Explain the rule of zero, three and five.
::answer
Zero: let members manage resources, declare no special members. Three (pre-C++11): if you need a destructor, copy constructor or copy assignment, you need all three. Five: add move constructor and move assignment.
:::

:::question{#Q2}
When does the compiler generate a move constructor? What happens if you add an empty destructor?
::answer
Only if the class has no user-declared copy constructor, copy assignment, move assignment or destructor. An empty destructor suppresses it, so moves become copies, which is a silent performance bug.
:::

:::question{#Q3}
In what order are members initialized? Why does it matter?
::answer
Bases in declaration order, then members in declaration order, regardless of the initializer list. Initializing one member from another declared later reads an uninitialized value.
:::

:::question{#Q4}
Why use the initializer list instead of assigning in the constructor body?
::answer
Members are default-constructed before the body runs, so assignment does the work twice. `const` members, references and types without default constructors can only be set in the list.
:::

:::question{#Q5}
What does `explicit` prevent? Give a bug it stops.
::answer
Implicit conversions through single-argument constructors or conversion operators. The `Socket(int)` example closes a file descriptor through an accidental temporary.
:::

:::question{#Q6}
What is copy-and-swap, and what guarantees does it give?
::answer
Take the argument by value and swap with it. It handles self-assignment, reuses the copy and move constructors, and gives the strong guarantee, at the cost of an extra move.
:::

:::question{#Q7}
Why are `==` and `+` usually non-members? What's a hidden friend?
::answer
So implicit conversions apply to both operands symmetrically. A hidden friend is a `friend` function defined inside the class; it's only found through ADL, keeping it out of unrelated overload sets.
:::

:::question{#Q8}
What does `mutable` do, and when is it legitimate?
::answer
It lets a `const` member function modify that member. It's legitimate for state that doesn't affect observable value: caches, mutexes, statistics counters.
:::

:::question{#Q9}
What's the difference between `struct` and `class`?
::answer
Only the default access for members and bases: public for `struct`, private for `class`.
:::

:::question{#Q10}
What's the size of an empty class, and what are EBO and `[[no_unique_address]]`?
::answer
At least 1, so distinct objects have distinct addresses. As a base, an empty class can take zero bytes (EBO). `[[no_unique_address]]` gives members the same ability. This matters for stateless allocators and deleters.
:::

:::question{#Q11}
What does a defaulted `operator<=>` give you?
::answer
All six relational operators via memberwise lexicographic comparison in declaration order, plus a defaulted `==`, with reversed-operand rewrites.
:::
