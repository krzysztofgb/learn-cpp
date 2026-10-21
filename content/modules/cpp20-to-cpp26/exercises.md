:::exercise{#E1 level=warm-up title="`<=>` in practice"}
Give `Price` (ticks) and `Order` (price, time, id) defaulted comparisons, then a custom `<=>` for bid priority (higher price first, earlier time first). Verify sorting with `std::ranges::sort`.
:::

:::exercise{#E2 level=standard title="Generator from scratch"}
Implement `Generator<T>` with a `promise_type`, iterator and sentinel, and use it to stream parsed messages from a buffer. Then compare with `std::generator`.
:::

:::exercise{#E3 level=standard title="Awaitable task"}
Implement a minimal `Task<T>` that starts suspended and resumes its awaiting coroutine on completion via symmetric transfer (`await_suspend` returning a `coroutine_handle`). Chain three tasks. Verify with ASan that frames are destroyed.
::hint
In `final_suspend`, return an awaiter whose `await_suspend` returns the continuation handle; that's symmetric transfer, and it avoids stack growth when chaining.
:::

:::exercise{#E4 level=standard title="Deducing `this`"}
Remove `const`/non-`const` duplication from a container's `at()` and `operator[]`, and write a recursive lambda computing Fibonacci without `std::function`.
:::

:::exercise{#E5 level=interview-hard title="Reflection"}
On Compiler Explorer with a reflection-enabled Clang or GCC trunk (`-freflection` or equivalent), write `enum_to_string` and a function that prints every field of an arbitrary aggregate as `name=value`.
::hint
Use `template for (constexpr auto m : std::define_static_array(nonstatic_data_members_of(^^T, std::meta::access_context::unchecked())))` and splice `obj.[:m:]`; exact names vary across implementations.
:::

:::exercise{#E6 level=standard title="Contracts"}
With a contracts-enabled compiler on Compiler Explorer, annotate an order validation function with `pre` and `post`, and observe behavior under the ignore, observe and enforce semantics.
:::
