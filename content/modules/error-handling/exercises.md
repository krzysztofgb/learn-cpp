:::exercise{#E1 level=warm-up title="Guarantees in code"}
Write four versions of `void Account::transfer(Account& to, int64_t amt)`, one per guarantee level, where an intermediate step may throw. Write a test that injects a throw and checks the post-state for each.
:::

:::exercise{#E2 level=standard title="Strong-guarantee stack"}
Implement `Stack<T>` over `std::vector<T>` with `push` and `pop`. Explain why `std::stack` splits `top()` and `pop()` instead of having `T pop()` (hint: what happens if copying the returned value throws?).
::hint
If `T pop()` removed the element and then copying the return value threw, the element would be lost. Splitting lets `top()` copy first and `pop()` remove only after success.
:::

:::exercise{#E3 level=standard title="From exceptions to `expected`"}
Rewrite a three-stage parser (tokenize, parse fields, validate) from exceptions to `std::expected` using `and_then`. Compare the call sites with the explicit check-after-every-call style, where each stage is followed by `if (!r) return std::unexpected(r.error());`.

> **Coming from Go?** That explicit style is Go's `if err != nil { return err }`.
:::

:::exercise{#E4 level=standard title="Measure it"}
Benchmark a function that fails at rates of 0%, 0.1%, 1% and 50%, reporting failure via exception, `std::expected` and an error code. Plot cost per call and explain where each approach wins.
::hint
At 0% failure, exceptions are typically the fastest because the happy path has no checks. As failure rates rise, exceptions become orders of magnitude slower.
:::

:::exercise{#E5 level=interview-hard title="Life without exceptions"}
Build a small program with `-fno-exceptions`. Observe what happens with `std::vector::at` out of range and with `throw` in your own code. Then design an allocation-failure-aware `FixedVector<T, N>` API returning `bool` or `std::expected`.
:::
