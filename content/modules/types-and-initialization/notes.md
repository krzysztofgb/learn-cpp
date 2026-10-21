### Fundamental types: what's guaranteed

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

### Integer promotion

Before arithmetic, any type smaller than `int` (`bool`, `char`, `short` and their unsigned versions) is promoted to `int` if `int` can hold all its values. Arithmetic on `uint8_t` therefore happens in `int`, and the result is an `int`.

The dangerous consequence: two `uint16_t` values multiply as signed `int`. `65535 * 65535` exceeds `INT_MAX`, so that multiplication is signed overflow and UB, even though both operands were unsigned.

### The usual arithmetic conversions

After promotion, a binary operator brings both operands to a common type. The rule that bites is mixed signedness:

1. If both have the same signedness, the smaller rank converts to the larger.
2. If the unsigned type has rank greater than or equal to the signed type, the signed operand converts to unsigned. That's why `-1 < 1u` is false: `-1` becomes `UINT_MAX`.
3. Otherwise, if the signed type can represent every value of the unsigned type, the unsigned operand converts to signed.
4. Otherwise, both convert to the unsigned version of the signed type.

Rule 3 vs rule 4 depends on the platform. `-1L < 1u` is true on LP64 (a 64-bit `long` holds every `unsigned int`) and false on Windows (a 32-bit `long` doesn't). C++20's `std::cmp_less` and friends in `<utility>` compare mixed integer types by value, with no conversion surprises.

`size_t` arithmetic is the everyday version of this trap. `v.size() - 1` on an empty vector is `SIZE_MAX`, and `i >= 0` is always true for an unsigned `i`.

### Overflow, division and shifts

- **Signed overflow is UB.** The optimizer assumes it never happens, so `x + 1 > x` folds to `true` and `(x * 2) / 2` folds to `x`. This assumption also lets it widen `int` loop counters and vectorize loops.
- **Unsigned overflow is defined:** arithmetic wraps modulo 2^N.
- **Division:** integer division by zero is UB. `INT_MIN / -1` and `INT_MIN % -1` are UB because the quotient doesn't fit. `-INT_MIN` and `std::abs(INT_MIN)` are UB for the same reason.
- **Shifts:** a shift count that's negative or at least the operand's width is UB. Since C++20, `<<` on a negative value is defined (it wraps), and `>>` on a negative value is an arithmetic shift.
- **Conversions:** converting an out-of-range integer to a signed type has been defined (modulo 2^N) since C++20. Converting an out-of-range floating-point value to an integer is UB.

### Floating point in one paragraph

Assume IEEE 754 (check `std::numeric_limits<double>::is_iec559`). `0.1 + 0.2 != 0.3` because neither 0.1 nor 0.2 is exact in binary, while `0.5 + 0.25 == 0.75` is exact. `NaN != NaN`, and `-0.0 == 0.0`. Trading systems usually store prices as integer ticks or fixed-point `int64_t`, because floating-point rounding makes equality comparisons and summing order-dependent.

### Initialization

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

### `auto` and `decltype`

`auto` deduces like a template parameter taken by value: it drops references and top-level `const`. Write `auto&`, `const auto&` or `auto&&` when you want a reference.

`decltype(x)` gives the declared type of the name `x`. `decltype((x))` treats `(x)` as an lvalue expression and gives `int&`. `decltype(auto)` deduces with `decltype` rules, which matters for returning references from forwarding functions.

### The `const` family

| Keyword | Means | Runs at |
| --- | --- | --- |
| `const` | Read-only through this name | Can be initialized at runtime |
| `constexpr` variable | Constant expression, implies `const` | Compile time |
| `constexpr` function | *May* be evaluated at compile time | Either |
| `consteval` function | *Must* be evaluated at compile time | Compile time |
| `constinit` variable | Static initialization guaranteed (no init-order fiasco); not `const` | Compile time init, mutable after |

Modifying an object that was *defined* `const` is UB, even through `const_cast`. Casting away `const` is only safe when the original object wasn't `const`.

A useful property: core-language UB (signed overflow, invalid shifts, out-of-bounds pointer arithmetic, division by zero) disqualifies an expression from being a constant expression (\[expr.const\]), so the compiler must reject it in a constant-evaluated context. UB in the standard library is different: whether it's caught there is unspecified. Putting a test in a `static_assert` or `constexpr` context turns many silent bugs into compile errors.

### Vocabulary and evaluation order

| Term | Meaning | Example |
| --- | --- | --- |
| Implementation-defined | Platform picks and must document | Signedness of `char`, `sizeof(long)` |
| Unspecified | Platform picks, needn't document or be consistent | Order of evaluating function arguments |
| Undefined | No requirements at all; optimizer assumes it never happens | Signed overflow, out-of-bounds access |
| Erroneous (C++26) | Defined but wrong; may be diagnosed | Reading an uninitialized `int` |

Evaluation order: since C++17, `a << b`, `a >> b`, `a[b]`, `a.b` and `a->b` evaluate `a` before `b`, and in `a = b` the right side is evaluated first. Function arguments are *indeterminately sequenced*: each one is evaluated fully before the next starts, in an unspecified order. Two unsequenced modifications of the same scalar, as in `i++ + i++`, are still UB.
