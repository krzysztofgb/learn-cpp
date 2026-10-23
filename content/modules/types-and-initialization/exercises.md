Compile everything with the debug flags from the Setup section, on both Clang and GCC. An exercise is done when it passes your tests under ASan and UBSan with zero warnings.

:::exercise{#E1 level=warm-up title="Type survey"}
Write a program that prints, for every fundamental integer and floating-point type: `sizeof`, `alignof`, `std::numeric_limits<T>::is_signed`, `min()` and `max()`. Run it on your machine, then paste it into Compiler Explorer with an x86-64 Linux GCC, an ARM64 GCC and `x64 msvc`. Note every row that changes.
:::

:::exercise{#E2 level=warm-up title="Initialization zoo"}
For `int`, `double`, `std::string` and an aggregate `struct Order { int qty; double px; };`, write each initialization form from the table in :sec[types-and-initialization/initialization]. Before compiling with `-Werror -Wconversion -Wuninitialized`, predict which lines fail and why. Then add a narrowing case to each brace form and confirm the error.
:::

:::exercise{#E3 level=standard title="Overflow-safe addition"}
Implement `bool add_overflows(int a, int b)` three ways, each without UB:

1. Pre-checks against `INT_MAX` and `INT_MIN` before adding.
2. `__builtin_add_overflow`, available in both Clang and GCC.
3. A `saturating_add(int, int)` that clamps to the limits. Compare it with C++26's `std::add_sat` from `<numeric>` if your compiler has it.

Test all three on every combination of `INT_MIN`, `-1`, `0`, `1` and `INT_MAX`.
::hint
For the pre-check, overflow happens exactly when `b > 0 && a > INT_MAX - b` or `b < 0 && a < INT_MIN - b`. Neither subtraction can overflow.
:::

:::exercise{#E4 level=standard title="Mixed-sign comparison"}
Write `template <std::integral T, std::integral U> constexpr bool safe_less(T a, U b)` that compares by mathematical value for any pair of integer types. Verify it with `static_assert` against `std::cmp_less` on the cases from :sec[types-and-initialization/the-usual-arithmetic-conversions], including `-1` vs `1u` and `-1L` vs `1u`.
::hint
If exactly one of the two is signed and negative, the answer is known without comparing. Otherwise convert both to `std::make_unsigned_t` of the larger type.
:::

:::exercise{#E5 level=standard title="Fixed-point prices"}
Write `std::optional<std::int64_t> parse_price(std::string_view s)` that converts a decimal string like `"123.4567"` into integer ticks of 0.0001, with no floating point anywhere. Return `std::nullopt` for malformed input, more than 4 decimals, or any value that would overflow `int64_t`. Then write `to_string` for the reverse and round-trip-test both.
::hint
Check for overflow before each `value = value * 10 + digit` step: compare against `(INT64_MAX - digit) / 10`.
:::

:::exercise{#E6 level=interview-hard title="Read the optimizer"}
In Compiler Explorer at `-O2`, compile:

```cpp kind=fragment run=local
int  f(int x)      { return (x * 2) / 2; }
unsigned g(unsigned x) { return (x * 2) / 2; }
bool h(int x)      { return x + 1 > x; }
```

Explain in three sentences why `f` becomes `return x`, `g` keeps an operation, and `h` becomes `return true`. Then compile a loop summing `a[i]` with an `int` index vs an `unsigned` index and explain any difference in the generated code.
::hint
`f` and `h` rely on signed overflow never happening. For `g`, wrapping is defined, so `(x * 2) / 2` really does clear the top bit and the compiler must emit an AND. The `unsigned` loop index may wrap, which can block widening it to a 64-bit address offset.
:::

:::exercise{#E7 level=interview-hard title="Let the compiler catch UB"}
Write a `constexpr` function that builds a `std::array<std::uint8_t, 256>` popcount lookup table, and verify a few entries with `static_assert`. Then write `constexpr int bad = INT_MAX + 1;` and `constexpr int s = 1 << 32;` and record the exact diagnostics from both compilers. Finally, write a `consteval` test harness that runs your E3 functions on the edge cases at compile time.
:::
