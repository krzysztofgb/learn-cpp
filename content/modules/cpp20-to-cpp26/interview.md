:::question{#Q1}
What does `<=>` give you, and what are the three ordering categories?
::answer
One operator generating all relational comparisons, with rewritten and reversed candidates. Strong (substitutable equality), weak (equivalence without substitutability), partial (incomparable values exist).
:::

:::question{#Q2}
How do C++ coroutines work? What does the compiler generate?
::answer
The function body becomes a state machine; locals move into a heap frame; the return type's `promise_type` controls creation, suspension, results and exceptions; `co_await` calls the awaitable's three hooks.
:::

:::question{#Q3}
How do C++ coroutines compare with threads and with stackful coroutines (fibers)?
::answer
Threads are OS-scheduled with their own stacks (MB-scale, microsecond switches). Stackful coroutines (fibers) are scheduled in user space, each with its own smaller stack, and can suspend from any call depth. C++ coroutines are stackless state machines that suspend only at `co_` points, costing a frame allocation and nanoseconds to switch, but need an external scheduler.

> **Coming from Go?** Goroutines are stackful coroutines with small growable stacks, multiplexed onto OS threads by the Go runtime, which parks them at any blocking call.
:::

:::question{#Q4}
What's dangerous about reference parameters in coroutines?
::answer
The caller's arguments may be destroyed while the coroutine is suspended, so references dangle on resumption.
:::

:::question{#Q5}
What problem does deducing `this` solve?
::answer
Writing one member function for all cv/ref qualifications of `this`, recursive lambdas, and static polymorphism without CRTP.
:::

:::question{#Q6}
What do modules improve over headers?
::answer
Faster builds (parse once), isolation from macros, explicit exports, no ODR issues from include order.
:::

:::question{#Q7}
Which C++26 features matter most for low-latency trading, and why?
::answer
Reflection (serialization and decoders without codegen), `std::execution` (structured async), hazard pointers/RCU (lock-free reclamation), `std::simd` (portable vectorization), `inplace_vector` (no-alloc containers), contracts and hardening (safety).
:::

:::question{#Q8}
What is static reflection useful for?
::answer
Generating code from type structure at compile time: serializers, parsers, enum names, ORMs, comparison and hashing.
:::

:::question{#Q9}
What's the difference between `[[likely]]` and `[[assume]]`?
::answer
`[[likely]]` only influences code layout and has no semantic effect. `[[assume]]` gives the optimizer a fact; if it's false, behavior is undefined.
:::

:::question{#Q10}
What is erroneous behavior?
::answer
A new category in C++26: the behavior is well-defined (for example, an uninitialized read gives some value) but the program is incorrect, and implementations are encouraged to diagnose it. It replaces UB for uninitialized locals.
:::
