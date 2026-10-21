:::question{#Q1}
Name and define the exception safety guarantees.
::answer
No-throw, strong (no change on failure), basic (valid but unspecified state, no leaks), none. See table 7.2.
:::

:::question{#Q2}
Why does it matter whether a move constructor is `noexcept`?
::answer
`vector` and other containers use moves during reallocation only if they can't throw, to keep the strong guarantee. Otherwise they copy, which can be far slower.
:::

:::question{#Q3}
What do exceptions cost on the happy path and when thrown?
::answer
Zero runtime overhead when nothing throws with table-based unwinding, but larger binaries. A throw costs microseconds: allocation, table lookup, unwinding.
:::

:::question{#Q4}
Why do many trading firms disable exceptions, and what do they use instead?
::answer
Thrown exceptions have unpredictable latency and bloat hot code. Firms use error codes, `std::expected`, or status enums on the hot path, and sometimes exceptions only at startup.
:::

:::question{#Q5}
Error codes vs exceptions vs `std::expected`: when would you use each?
::answer
Exceptions for rare, unrecoverable-at-this-level errors (startup, configuration); `expected` for expected failures the caller must handle; error codes at C boundaries or with OS APIs.
:::

:::question{#Q6}
What happens if an exception escapes a `noexcept` function?
::answer
`std::terminate` is called; the stack may or may not be unwound.
:::

:::question{#Q7}
Can a destructor throw? What happens if it does?
::answer
It can if declared `noexcept(false)`, but it's almost always a mistake: during unwinding it terminates the program, and by default destructors are `noexcept`, so throwing terminates immediately.
:::

:::question{#Q8}
Why catch by reference? What's the difference between `throw;` and `throw e;`?
::answer
By reference to avoid slicing and copies. `throw;` rethrows the original object; `throw e;` copies `e` as its static type.
:::

:::question{#Q9}
How does `std::future` deliver an exception from another thread?
::answer
The worker catches the exception and stores a `std::exception_ptr` in the shared state; `future::get()` rethrows it in the calling thread.
:::

:::question{#Q10}
What problem do C++26 contracts solve?
::answer
They state preconditions, postconditions and assertions in the code itself, checkable according to a build-wide policy, so bugs in how a function is called are caught without ad hoc `assert` macros.
:::
