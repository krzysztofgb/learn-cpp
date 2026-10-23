Answer each out loud in 60–90 seconds, then check the key. These come up in C++ phone screens nearly word for word.

:::question{#Q1}
What's the difference between undefined, unspecified and implementation-defined behavior? Give an example of each.
::answer
**Implementation-defined** behavior is chosen and documented by the platform (`sizeof(long)`, signedness of `char`). **Unspecified** behavior is one of several allowed outcomes, with no documentation or consistency required (order of evaluating function arguments). **Undefined** behavior has no requirements at all (signed overflow, out-of-bounds access), and the optimizer assumes it never happens, so its effects can appear far from the bug.
:::

:::question{#Q2}
Why is signed overflow UB while unsigned overflow wraps? What does the compiler gain from the UB?
::answer
Historically C supported machines that didn't use two's complement, so overflow had no portable meaning. It stays UB because compilers exploit it: they fold `x + 1 > x`, simplify `(x * 2) / 2`, widen 32-bit loop counters to 64-bit addresses, compute trip counts and vectorize. Unsigned wraps because modular arithmetic is genuinely useful for hashing and checksums. Tools: `-fwrapv` defines wrapping, and UBSan catches overflow at runtime.
:::

:::question{#Q3}
What is integer promotion? Describe a real bug it causes.
::answer
Types smaller than `int` convert to `int` before arithmetic. Bugs: `uint16_t * uint16_t` overflowing signed `int`. `uint8_t x = 255; x + 1 == 0` is false because `x + 1` is the `int` 256. `~m == 0xF0` for `uint8_t m = 0x0F` is false because `~m` is the `int` `0xFFFFFFF0`.
:::

:::question{#Q4}
`int` vs `int32_t` vs `int_fast32_t`: when would you use each? Is `int32_t` guaranteed to exist?
::answer
Use `int` for ordinary counts and arithmetic. Use `int32_t` when the exact width matters: wire protocols, file formats, struct layouts. Use `int_fast32_t` rarely, since it can be 64 bits and silently change struct sizes. `int32_t` is optional in the standard but exists on every mainstream platform.
:::

:::question{#Q5}
What's the difference between `T x;`, `T x{};` and `T x();`?
::answer
`T x;` default-initializes: it calls the default constructor for class types and leaves scalars indeterminate at block scope. `T x{};` value-initializes, which zeroes scalars. `T x();` declares a function (the most vexing parse).
:::

:::question{#Q6}
Why do style guides recommend brace initialization? When does it give you something you didn't expect?
::answer
Braces work in every context, reject narrowing, avoid the vexing parse, and `{}` zero-initializes. The surprise is that any viable `initializer_list` constructor wins, so `std::vector<int>{3, 7}` holds two elements. Also, `auto x = {5}` is an `initializer_list`.
:::

:::question{#Q7}
Explain `const`, `constexpr`, `consteval` and `constinit`.
::answer
`const` means read-only and may be initialized at runtime. A `constexpr` variable is a compile-time constant. A `constexpr` function *can* run at compile time; `consteval` *must*. `constinit` guarantees static initialization (avoiding the init-order fiasco) but leaves the variable mutable.
:::

:::question{#Q8}
Is `char` signed?
::answer
It's implementation-defined, and `char` is a distinct type from both `signed char` and `unsigned char`. It's signed on x86-64 and Apple ARM64 (macOS), unsigned on ARM64 Linux. For byte manipulation, use `unsigned char` or `std::byte` explicitly.
:::

:::question{#Q9}
How would you represent prices in a trading system, and why not `double`?
::answer
Use integer ticks (`int64_t` multiples of the instrument's minimum price increment) or fixed-point with a known scale. A `double` can't represent most decimal prices exactly, so equality checks, order book price-level keys and sums break. Doubles remain fine for model outputs and analytics. Watch overflow in price × quantity: compute notional in `int64_t` with checks, or `__int128`.
:::

:::question{#Q10}
What happens when you read an uninitialized local variable? How does C++26 change that?
::answer
Through C++23 it's UB, except for copying via `unsigned char` or `std::byte`. In practice you get garbage, or the optimizer deletes the path. In C++26 it's erroneous behavior: the read gives some valid value, the program is defined but wrong, and implementations may diagnose it. `[[indeterminate]]` opts out. Clang and GCC already offer `-ftrivial-auto-var-init=pattern` or `=zero`.
:::

:::question{#Q11}
Does C++17 define the evaluation order of `f(a(), b())`? Of `a() << b()`? Of `x = y()`?
::answer
For `f(a(), b())`, the order is unspecified, but the two calls never interleave. For `a() << b()`, `a()` runs first since C++17, which also makes chained `std::cout <<` well-defined. For `x = y()`, `y()` runs first since C++17. `a() + b()` is still unspecified.
:::
