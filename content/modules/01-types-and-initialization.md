# Module 1: Types and initialization

Most C++ bugs that pass code review come from the rules in this module: implicit conversions, overflow, and initialization. Interviewers use them for warm-up questions because a wrong answer reveals a Go- or Java-shaped mental model fast.

## Notes

### 1.1 Fundamental types: what's guaranteed

The standard guarantees minimum widths, not exact ones. Everything else is the platform's data model.

| Type | Guaranteed minimum | LP64 (macOS, Linux) | LLP64 (Windows) |
| --- | --- | --- | --- |
| `char` | 8 bits, `sizeof == 1` | 8 | 8 |
| `short` | 16 bits | 16 | 16 |
| `int` | 16 bits | 32 | 32 |
| `long` | 32 bits | **64** | **32** |
| `long long` | 64 bits | 64 | 64 |
| pointer | none | 64 | 64 |

- `char`, `signed char` and `unsigned char` are three distinct types. Whether plain `char` is signed is implementation-defined: signed on x86-64 and on Apple ARM64, unsigned on ARM64 Linux. Your Mac and a Linux ARM server disagree.
- `std::uint8_t` is almost always a typedef for `unsigned char`, so streams print it as a character.
- `std::int32_t` and friends are optional. They exist only if the platform has an exact-width type with no padding bits. `std::int_least32_t` always exists; `std::int_fast32_t` is the fastest type with at least 32 bits.
- Since C++20, signed integers are required to be two's complement. Signed overflow is still UB anyway.

### 1.2 Integer promotion

Before arithmetic, any type smaller than `int` (`bool`, `char`, `short` and their unsigned versions) is promoted to `int` if `int` can hold all its values. Arithmetic on `uint8_t` therefore happens in `int`, and the result is an `int`.

The dangerous consequence: two `uint16_t` values multiply as signed `int`. `65535 * 65535` exceeds `INT_MAX`, so that multiplication is signed overflow and UB, even though both operands were unsigned.

### 1.3 The usual arithmetic conversions

After promotion, a binary operator brings both operands to a common type. The rule that bites is mixed signedness:

1. If both have the same signedness, the smaller rank converts to the larger.
2. If the unsigned type has rank greater than or equal to the signed type, the signed operand converts to unsigned. That's why `-1 < 1u` is false: `-1` becomes `UINT_MAX`.
3. Otherwise, if the signed type can represent every value of the unsigned type, the unsigned operand converts to signed.
4. Otherwise, both convert to the unsigned version of the signed type.

Rule 3 vs rule 4 depends on the platform. `-1L < 1u` is true on LP64 (a 64-bit `long` holds every `unsigned int`) and false on Windows (a 32-bit `long` doesn't). C++20's `std::cmp_less` and friends in `<utility>` compare mixed integer types by value, with no conversion surprises.

`size_t` arithmetic is the everyday version of this trap. `v.size() - 1` on an empty vector is `SIZE_MAX`, and `i >= 0` is always true for an unsigned `i`.

### 1.4 Overflow, division and shifts

- **Signed overflow is UB.** The optimizer assumes it never happens, so `x + 1 > x` folds to `true` and `(x * 2) / 2` folds to `x`. This assumption also lets it widen `int` loop counters and vectorize loops.
- **Unsigned overflow is defined:** arithmetic wraps modulo 2^N.
- **Division:** integer division by zero is UB. `INT_MIN / -1` and `INT_MIN % -1` are UB because the quotient doesn't fit. `-INT_MIN` and `std::abs(INT_MIN)` are UB for the same reason.
- **Shifts:** a shift count that's negative or at least the operand's width is UB. Since C++20, `<<` on a negative value is defined (it wraps), and `>>` on a negative value is an arithmetic shift.
- **Conversions:** converting an out-of-range integer to a signed type has been defined (modulo 2^N) since C++20. Converting an out-of-range floating-point value to an integer is UB.

### 1.5 Floating point in one paragraph

Assume IEEE 754 (check `std::numeric_limits<double>::is_iec559`). `0.1 + 0.2 != 0.3` because neither 0.1 nor 0.2 is exact in binary, while `0.5 + 0.25 == 0.75` is exact. `NaN != NaN`, and `-0.0 == 0.0`. Trading systems usually store prices as integer ticks or fixed-point `int64_t`, because floating-point rounding makes equality comparisons and summing order-dependent.

### 1.6 Initialization

| Form | Example | Effect for `int` |
| --- | --- | --- |
| Default | `int x;` | Automatic storage: indeterminate. Static or thread storage: zero. |
| Value | `int x{};` or `int()` | Zero |
| Direct | `int x(5);` | 5, narrowing allowed |
| Copy | `int x = 5;` | 5, narrowing allowed |
| Direct-list | `int x{5};` | 5, narrowing is a compile error |
| Copy-list | `int x = {5};` | 5, narrowing is a compile error |

- **Narrowing** means a conversion that may lose information: floating to integer, a wider integer to a narrower one (unless it's a constant that fits), or integer to floating point when the value might not be exact.
- **Most vexing parse:** `Timer t();` declares a function returning `Timer`, not an object. `Widget w(Gadget());` is also a function declaration. Braces fix both.
- **The `initializer_list` trap:** braces prefer an `initializer_list` constructor whenever one is viable. `std::vector<int> v(3, 7)` is `{7, 7, 7}`, but `std::vector<int> v{3, 7}` is `{3, 7}`.
- **`auto` with braces:** since C++17, `auto x{5}` is `int`, while `auto x = {5}` is `std::initializer_list<int>`.
- **Aggregates** can use designated initializers since C++20 (`Point p{.x = 1, .y = 2}`), and the designators must appear in declaration order.
- **Reading an uninitialized variable:** UB up to C++23. C++26 makes it *erroneous behavior* instead: the read yields some valid value, the program is wrong, and implementations are encouraged to diagnose it. `[[indeterminate]]` opts a variable out, restoring the old performance and UB. This applies only to automatic storage: objects with dynamic storage (new int) still start with indeterminate values, so reading them before initialization remains UB (\[basic.indet\]).

### 1.7 `auto` and `decltype`

`auto` deduces like a template parameter taken by value: it drops references and top-level `const`. Write `auto&`, `const auto&` or `auto&&` when you want a reference.

`decltype(x)` gives the declared type of the name `x`. `decltype((x))` treats `(x)` as an lvalue expression and gives `int&`. `decltype(auto)` deduces with `decltype` rules, which matters for returning references from forwarding functions.

### 1.8 The `const` family

| Keyword | Means | Runs at |
| --- | --- | --- |
| `const` | Read-only through this name | Can be initialized at runtime |
| `constexpr` variable | Constant expression, implies `const` | Compile time |
| `constexpr` function | *May* be evaluated at compile time | Either |
| `consteval` function | *Must* be evaluated at compile time | Compile time |
| `constinit` variable | Static initialization guaranteed (no init-order fiasco); not `const` | Compile time init, mutable after |

Modifying an object that was *defined* `const` is UB, even through `const_cast`. Casting away `const` is only safe when the original object wasn't `const`.

A useful property: core-language UB (signed overflow, invalid shifts, out-of-bounds pointer arithmetic, division by zero) disqualifies an expression from being a constant expression (\[expr.const\]), so the compiler must reject it in a constant-evaluated context. UB in the standard library is different: whether it's caught there is unspecified. Putting a test in a `static_assert` or `constexpr` context turns many silent bugs into compile errors.

### 1.9 Vocabulary and evaluation order

| Term | Meaning | Example |
| --- | --- | --- |
| Implementation-defined | Platform picks and must document | Signedness of `char`, `sizeof(long)` |
| Unspecified | Platform picks, needn't document or be consistent | Order of evaluating function arguments |
| Undefined | No requirements at all; optimizer assumes it never happens | Signed overflow, out-of-bounds access |
| Erroneous (C++26) | Defined but wrong; may be diagnosed | Reading an uninitialized `int` |

Evaluation order: since C++17, `a << b`, `a >> b`, `a[b]`, `a.b` and `a->b` evaluate `a` before `b`, and in `a = b` the right side is evaluated first. Function arguments are *indeterminately sequenced*: each one is evaluated fully before the next starts, in an unspecified order. Two unsequenced modifications of the same scalar, as in `i++ + i++`, are still UB.

## Predict the output

Assume each snippet sits inside `main` with the needed headers, compiled as C++23 on your Mac unless the snippet says otherwise. Write your answer down for all 12 before checking the key. "UB", "implementation-defined" and "doesn't compile" are valid answers.

**P1**

```cpp kind=fragment run=local
unsigned u = 1;
int i = -1;
std::cout << (i < u) << '\n';
```

**P2**

```cpp kind=fragment run=local
std::uint8_t a = 200, b = 100;
auto c = a + b;
std::cout << c << ' ' << sizeof(c) << '\n';
```

**P3**

```cpp kind=fragment run=local
std::uint8_t x = 65;
std::cout << x << ' ' << +x << '\n';
```

**P4**

```cpp kind=fragment run=local
std::vector<int> a(3, 7), b{3, 7};
std::cout << a.size() << ' ' << b.size() << '\n';
```

**P5** (What does it print on your Mac, and on an ARM64 Linux server?)

```cpp kind=fragment run=local
char c = static_cast<char>(0xFF);
std::cout << static_cast<int>(c) << '\n';
```

**P6** (On your Mac, and on 64-bit Windows?)

```cpp kind=fragment run=local note="In the browser this is wasm32, where `long` and pointers are 32-bit (like Windows), so this prints 0. On your Mac (LP64) it prints 1."
std::cout << (-1L < 1u) << '\n';
```

**P7**

```cpp kind=fragment run=local
auto a{5};
auto b = {5};
std::cout << std::is_same_v<decltype(a), int>
          << std::is_same_v<decltype(b), int> << '\n';
```

**P8**

```cpp kind=fragment run=local
int i = 0;
i = i++ + 1;
std::cout << i << '\n';
```

**P9**

```cpp kind=fragment run=local
int x = 5;
decltype(x) a = x;
decltype((x)) b = x;
a = 7;
b = 10;
std::cout << x << '\n';
```

**P10**

```cpp kind=fragment run=local
std::cout << sizeof('a') << ' ' << sizeof(true + true) << ' '
          << (true + true) << '\n';
```

**P11**

```cpp kind=fragment run=local
double d = 0.1 + 0.2;
std::cout << (d == 0.3) << ' ' << (0.5 + 0.25 == 0.75) << '\n';
```

**P12** (the whole program)

```cpp kind=program run=local
#include <iostream>
struct Timer {
    Timer() { std::cout << "start "; }
};
int main() {
    Timer t();
    std::cout << "done\n";
}
```

## Spot the UB

Each snippet compiles. For each, say whether it has UB, which rule it breaks, and how to fix it. Not every line is broken, and not every problem is UB: some lines are fine, and some are merely unspecified. Say which is which.

**U1**

```cpp kind=fragment run=local
bool will_overflow(int x) {
    return x + 1 < x;
}
```

**U2**

```cpp kind=fragment run=local
void print_reversed(const std::vector<int>& v) {
    for (std::size_t i = v.size() - 1; i >= 0; --i)
        std::cout << v[i] << '\n';
}
```

**U3**

```cpp kind=fragment run=local
std::uint16_t a = 50000, b = 50000;
std::uint32_t area = a * b;
```

**U4**

```cpp kind=fragment run=local
int pick(bool cond) {
    int x;
    if (cond) x = 1;
    return x;
}
```

**U5**

```cpp kind=fragment run=local
std::uint32_t mask_for(int bits) {   // called with bits == 32
    return (1u << bits) - 1;
}
```

**U6**

```cpp kind=fragment run=local
int negate(int a) { return -a; }     // called with INT_MIN
```

**U7**

```cpp kind=fragment run=local
double notional = 3e10;
int n = static_cast<int>(notional);
```

**U8**

```cpp kind=fragment run=local
const int limit = 10;
const_cast<int&>(limit) = 20;
std::cout << limit << '\n';
```

**U9**

```cpp kind=fragment run=none
int i = 0;
int r = i++ + i++;
f(i++, i++);   // void f(int, int)
```

**U10**

```cpp kind=fragment run=local
int arr[4] = {};
int* end = arr + 4;
int* past = arr + 5;
```

## Exercises

Compile everything with the debug flags from the Setup section, on both Clang and GCC. An exercise is done when it passes your tests under ASan and UBSan with zero warnings.

**E1 ★ Type survey.** Write a program that prints, for every fundamental integer and floating-point type: `sizeof`, `alignof`, `std::numeric_limits<T>::is_signed`, `min()` and `max()`. Run it on your Mac, then paste it into Compiler Explorer with an x86-64 Linux GCC and with `x64 msvc`. Note every row that changes.

**E2 ★ Initialization zoo.** For `int`, `double`, `std::string` and an aggregate `struct Order { int qty; double px; };`, write each initialization form from table 1.6. Before compiling with `-Werror -Wconversion -Wuninitialized`, predict which lines fail and why. Then add a narrowing case to each brace form and confirm the error.

**E3 ★★ Overflow-safe addition.** Implement `bool add_overflows(int a, int b)` three ways, each without UB:

1. Pre-checks against `INT_MAX` and `INT_MIN` before adding.
2. `__builtin_add_overflow`, available in both Clang and GCC.
3. A `saturating_add(int, int)` that clamps to the limits. Compare it with C++26's `std::add_sat` from `<numeric>` if your compiler has it.

Test all three on every combination of `INT_MIN`, `-1`, `0`, `1` and `INT_MAX`.

**E4 ★★ Mixed-sign comparison.** Write `template <std::integral T, std::integral U> constexpr bool safe_less(T a, U b)` that compares by mathematical value for any pair of integer types. Verify it with `static_assert` against `std::cmp_less` on the cases from 1.3, including `-1` vs `1u` and `-1L` vs `1u`.

**E5 ★★ Fixed-point prices.** Write `std::optional<std::int64_t> parse_price(std::string_view s)` that converts a decimal string like `"123.4567"` into integer ticks of 0.0001, with no floating point anywhere. Return `std::nullopt` for malformed input, more than 4 decimals, or any value that would overflow `int64_t`. Then write `to_string` for the reverse and round-trip-test both.

**E6 ★★★ Read the optimizer.** In Compiler Explorer at `-O2`, compile:

```cpp kind=fragment run=local
int  f(int x)      { return (x * 2) / 2; }
unsigned g(unsigned x) { return (x * 2) / 2; }
bool h(int x)      { return x + 1 > x; }
```

Explain in three sentences why `f` becomes `return x`, `g` keeps an operation, and `h` becomes `return true`. Then compile a loop summing `a[i]` with an `int` index vs an `unsigned` index and explain any difference in the generated code.

**E7 ★★★ Let the compiler catch UB.** Write a `constexpr` function that builds a `std::array<std::uint8_t, 256>` popcount lookup table, and verify a few entries with `static_assert`. Then write `constexpr int bad = INT_MAX + 1;` and `constexpr int s = 1 << 32;` and record the exact diagnostics from both compilers. Finally, write a `consteval` test harness that runs your E3 functions on the edge cases at compile time.

## Interview questions

Answer each out loud in 60–90 seconds, then check the key. These come up in quant dev phone screens nearly word for word.

1. What's the difference between undefined, unspecified and implementation-defined behavior? Give an example of each.
2. Why is signed overflow UB while unsigned overflow wraps? What does the compiler gain from the UB?
3. What is integer promotion? Describe a real bug it causes.
4. `int` vs `int32_t` vs `int_fast32_t`: when would you use each? Is `int32_t` guaranteed to exist?
5. What's the difference between `T x;`, `T x{};` and `T x();`?
6. Why do style guides recommend brace initialization? When does it give you something you didn't expect?
7. Explain `const`, `constexpr`, `consteval` and `constinit`.
8. Is `char` signed?
9. How would you represent prices in a trading system, and why not `double`?
10. What happens when you read an uninitialized local variable? How does C++26 change that?
11. Does C++17 define the evaluation order of `f(a(), b())`? Of `a() << b()`? Of `x = y()`?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `0` | Usual arithmetic conversions turn `-1` into `UINT_MAX`, which isn't less than 1. |
| P2 | `300 4` | Both operands promote to `int`, so `c` is an `int` holding 300, not a wrapped `uint8_t`. |
| P3 | `A 65` | `uint8_t` is `unsigned char`, so `<<` prints it as a character. Unary `+` promotes it to `int`. |
| P4 | `3 2` | Parentheses call the (count, value) constructor. Braces pick the `initializer_list` constructor. |
| P5 | Mac: `-1`, Linux ARM64: `255` | Plain `char` is signed on Apple ARM64 and unsigned on Linux ARM64. The wrap to -1 is defined since C++20. |
| P6 | Mac: `1`, Windows: `0` | On LP64, `long` holds every `unsigned int`, so `1u` converts to `long`. On Windows both go to `unsigned long`, and `-1L` becomes huge. |
| P7 | `10` | `auto a{5}` is `int` since C++17. `auto b = {5}` is `std::initializer_list<int>`. |
| P8 | `1` | Well-defined since C++17: the right side, including the increment, finishes before the assignment. It was UB before C++17. |
| P9 | `10` | `decltype(x)` is `int` (a copy). `decltype((x))` is `int&`, so `b` aliases `x`. |
| P10 | `1 4 2` | In C++ a character literal is a `char` (in C it's an `int`). `bool + bool` promotes to `int`. |
| P11 | `0 1` | 0.1, 0.2 and 0.3 have no exact binary form. 0.5, 0.25 and 0.75 do. |
| P12 | `done` | `Timer t();` declares a function, so no `Timer` is constructed. Clang warns with `-Wvexing-parse`. |

### Spot the UB

**U1:** UB when `x == INT_MAX`. Because overflow "can't happen", the optimizer compiles the function to `return false`. Fix: `return x == INT_MAX;`.

**U2:** The condition `i >= 0` is always true for an unsigned `i`. That wrap itself is defined, but when `i` wraps to `SIZE_MAX`, `v[i]` reads out of bounds, which is UB. On an empty vector the very first read is already out of bounds. Fix: `for (std::size_t i = v.size(); i-- > 0;)` or iterate `v | std::views::reverse`.

**U3:** UB. Both operands promote to signed `int`, and 2.5 billion exceeds `INT_MAX`. Converting the result to `uint32_t` afterwards is too late. Fix: `std::uint32_t area = std::uint32_t{a} * b;`.

**U4:** When `cond` is false, `x` is read uninitialized: UB through C++23, erroneous behavior in C++26. Fix: initialize at the declaration.

**U5:** UB, since a shift count equal to the operand's width is out of range. In practice, x86 and ARM hardware mask the count so a runtime shift by 32 often gives 1 (and a mask of 0), while a constant-folded call may give something else. Fix: `return bits >= 32 ? ~0u : (1u << bits) - 1;`.

**U6:** UB, because `-INT_MIN` doesn't fit in `int`. Fix: check for `INT_MIN`, or return a wider type.

**U7:** UB, because 3e10 is outside `int`'s range and floating-to-integer conversion of an out-of-range value is undefined. Fix: range-check first, or use `std::int64_t` with a check.

**U8:** UB, since `limit` was defined `const`. It likely prints `10` because the compiler substituted the constant, and a `const` global in read-only memory would crash instead. There's no fix other than not doing it.

**U9:** `i++ + i++` is UB: two unsequenced modifications of `i`. `f(i++, i++)` is *not* UB since C++17. Arguments are indeterminately sequenced, so it's unspecified which parameter gets which value. It was UB before C++17.

**U10:** `arr + 4` is fine: you can form (but not dereference) the one-past-the-end pointer. `arr + 5` is UB just by being computed, before any dereference.

### Exercise hints

- **E3:** For the pre-check, overflow happens exactly when `b > 0 && a > INT_MAX - b` or `b < 0 && a < INT_MIN - b`. Neither subtraction can overflow.
- **E4:** If exactly one of the two is signed and negative, the answer is known without comparing. Otherwise convert both to `std::make_unsigned_t` of the larger type.
- **E5:** Check for overflow before each `value = value * 10 + digit` step: compare against `(INT64_MAX - digit) / 10`.
- **E6:** `f` and `h` rely on signed overflow never happening. For `g`, wrapping is defined, so `(x * 2) / 2` really does clear the top bit and the compiler must emit an AND. The `unsigned` loop index may wrap, which can block widening it to a 64-bit address offset.

### Interview questions

1. **Implementation-defined** behavior is chosen and documented by the platform (`sizeof(long)`, signedness of `char`). **Unspecified** behavior is one of several allowed outcomes, with no documentation or consistency required (order of evaluating function arguments). **Undefined** behavior has no requirements at all (signed overflow, out-of-bounds access), and the optimizer assumes it never happens, so its effects can appear far from the bug.
2. Historically C supported machines that didn't use two's complement, so overflow had no portable meaning. It stays UB because compilers exploit it: they fold `x + 1 > x`, simplify `(x * 2) / 2`, widen 32-bit loop counters to 64-bit addresses, compute trip counts and vectorize. Unsigned wraps because modular arithmetic is genuinely useful for hashing and checksums. Tools: `-fwrapv` defines wrapping, and UBSan catches overflow at runtime.
3. Types smaller than `int` convert to `int` before arithmetic. Bugs: `uint16_t * uint16_t` overflowing signed `int`. `uint8_t x = 255; x + 1 == 0` is false because `x + 1` is the `int` 256. `~m == 0xF0` for `uint8_t m = 0x0F` is false because `~m` is the `int` `0xFFFFFFF0`.
4. Use `int` for ordinary counts and arithmetic. Use `int32_t` when the exact width matters: wire protocols, file formats, struct layouts. Use `int_fast32_t` rarely, since it can be 64 bits and silently change struct sizes. `int32_t` is optional in the standard but exists on every mainstream platform.
5. `T x;` default-initializes: it calls the default constructor for class types and leaves scalars indeterminate at block scope. `T x{};` value-initializes, which zeroes scalars. `T x();` declares a function (the most vexing parse).
6. Braces work in every context, reject narrowing, avoid the vexing parse, and `{}` zero-initializes. The surprise is that any viable `initializer_list` constructor wins, so `std::vector<int>{3, 7}` holds two elements. Also, `auto x = {5}` is an `initializer_list`.
7. `const` means read-only and may be initialized at runtime. A `constexpr` variable is a compile-time constant. A `constexpr` function *can* run at compile time; `consteval` *must*. `constinit` guarantees static initialization (avoiding the init-order fiasco) but leaves the variable mutable.
8. It's implementation-defined, and `char` is a distinct type from both `signed char` and `unsigned char`. It's signed on x86-64 and Apple ARM64, unsigned on ARM64 Linux. For byte manipulation, use `unsigned char` or `std::byte` explicitly.
9. Use integer ticks (`int64_t` multiples of the instrument's minimum price increment) or fixed-point with a known scale. A `double` can't represent most decimal prices exactly, so equality checks, order book price-level keys and sums break. Doubles remain fine for model outputs and analytics. Watch overflow in price × quantity: compute notional in `int64_t` with checks, or `__int128`.
10. Through C++23 it's UB, except for copying via `unsigned char` or `std::byte`. In practice you get garbage, or the optimizer deletes the path. In C++26 it's erroneous behavior: the read gives some valid value, the program is defined but wrong, and implementations may diagnose it. `[[indeterminate]]` opts out. Clang and GCC already offer `-ftrivial-auto-var-init=pattern` or `=zero`.
11. For `f(a(), b())`, the order is unspecified, but the two calls never interleave. For `a() << b()`, `a()` runs first since C++17, which also makes chained `std::cout <<` well-defined. For `x = y()`, `y()` runs first since C++17. `a() + b()` is still unspecified.
