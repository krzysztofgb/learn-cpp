### Fundamental types: what's guaranteed

The standard guarantees minimum widths, not exact ones. Everything else is the platform's data model.

| Type | Guaranteed minimum | LP64 (64-bit macOS and Linux) | LLP64 (64-bit Windows) |
| --- | --- | --- | --- |
| `char` | 8 bits, `sizeof == 1` | 8 | 8 |
| `short` | 16 bits | 16 | 16 |
| `int` | 16 bits | 32 | 32 |
| `long` | 32 bits | **64** | **32** |
| `long long` | 64 bits | 64 | 64 |
| pointer | none | 64 | 64 |

- `char`, `signed char` and `unsigned char` are three distinct types. Whether plain `char` is signed is implementation-defined: signed on x86-64 (all three OSes) and on Apple ARM64 (macOS, iOS), unsigned on ARM64 Linux (AWS Graviton, Raspberry Pi). An Apple Silicon laptop and a Linux ARM server disagree. For raw bytes, say what you mean: `unsigned char` or `std::byte` (C++17, a byte type with bitwise operators but no arithmetic).
- A character literal such as `'a'` has type `char` in C++, so `sizeof('a') == 1`. (In C it has type `int`.)
- `std::uint8_t` is almost always a typedef for `unsigned char`, so streams print it as a character.
- `std::int32_t` and friends are optional. They exist only if the platform has an exact-width type with no padding bits. `std::int_least32_t` always exists; `std::int_fast32_t` is the fastest type with at least 32 bits, and it isn't always 32 bits: glibc on x86-64 makes `int_fast16_t` and `int_fast32_t` 64-bit, so using them in a struct can change its size from one platform to the next.
- Since C++20, signed integers are required to be two's complement (before that, C and C++ allowed ones' complement and sign-magnitude machines, which is why overflow had no portable meaning). Signed overflow is still UB anyway.

*Further reading:* [Introduction to fundamental data types](https://www.learncpp.com/cpp-tutorial/introduction-to-fundamental-data-types/), [Fixed-width integers and size_t](https://www.learncpp.com/cpp-tutorial/fixed-width-integers-and-size-t/), [Chars](https://www.learncpp.com/cpp-tutorial/chars/)

### Integer promotion

Before arithmetic, any type smaller than `int` (`bool`, `char`, `short` and their unsigned versions) is promoted to `int` if `int` can hold all its values (\[conv.prom\]). Arithmetic on `uint8_t` therefore happens in `int`, and the result is an `int`. This applies to the unary operators `+`, `-` and `~` as well as to binary ones, so `+x` is the idiomatic way to print a `uint8_t` as a number, and `~m` for a `uint8_t m = 0x0F` is the `int` `0xFFFFFFF0`, not `0xF0`. Likewise `x + 1` for a `uint8_t x = 255` is the `int` 256; it only wraps if you store it back into a `uint8_t`.

The dangerous consequence: two `uint16_t` values multiply as signed `int`. `65535 * 65535` exceeds `INT_MAX`, so that multiplication is signed overflow and UB, even though both operands were unsigned. Convert one operand to a wide enough unsigned type first.

*Further reading:* [Floating-point and integral promotion](https://www.learncpp.com/cpp-tutorial/floating-point-and-integral-promotion/), [Implicit type conversion](https://www.learncpp.com/cpp-tutorial/implicit-type-conversion/)

### The usual arithmetic conversions

After promotion, a binary operator brings both operands to a common type. The rule that bites is mixed signedness:

1. If both have the same signedness, the smaller rank converts to the larger.
2. If the unsigned type has rank greater than or equal to the signed type, the signed operand converts to unsigned. That's why `-1 < 1u` is false: `-1` becomes `UINT_MAX`.
3. Otherwise, if the signed type can represent every value of the unsigned type, the unsigned operand converts to signed.
4. Otherwise, both convert to the unsigned version of the signed type.

Rule 3 vs rule 4 depends on the platform. `-1L < 1u` is true on LP64 (a 64-bit `long` holds every `unsigned int`) and false on Windows (a 32-bit `long` doesn't). C++20's `std::cmp_less` and friends in `<utility>` compare mixed integer types by value, with no conversion surprises.

`size_t` arithmetic is the everyday version of this trap. `v.size() - 1` on an empty vector is `SIZE_MAX`, and `i >= 0` is always true for an unsigned `i`.

> **Coming from Go?** Go has no implicit numeric conversions: comparing an `int` with a `uint` is a compile error. C++ converts silently, by the rules above.

*Further reading:* [Arithmetic conversions](https://www.learncpp.com/cpp-tutorial/arithmetic-conversions/), [Unsigned integers, and why to avoid them](https://www.learncpp.com/cpp-tutorial/unsigned-integers-and-why-to-avoid-them/), [std::vector and the unsigned length and subscript problem](https://www.learncpp.com/cpp-tutorial/stdvector-and-the-unsigned-length-and-subscript-problem/)

### Overflow, division and shifts

- **Signed overflow is UB.** The optimizer assumes it never happens, so `x + 1 > x` folds to `true` and `(x * 2) / 2` folds to `x`. This assumption also lets it widen `int` loop counters to 64-bit address offsets, compute loop trip counts and vectorize loops. GCC and Clang's `-fwrapv` makes signed overflow wrap instead; UBSan (`-fsanitize=undefined`, which includes `signed-integer-overflow`) reports it at runtime.
- **Unsigned overflow is defined:** arithmetic wraps modulo 2^N. That's useful for hashes and checksums, but it also means the compiler must preserve the wrap: `(x * 2) / 2` on an `unsigned` really clears the top bit, and an `unsigned` loop index that might wrap can't simply be widened.
- **Checking instead of overflowing:** test against the limits before the operation (`b > 0 && a > INT_MAX - b`), use the GCC/Clang builtins `__builtin_add_overflow` and friends, or C++26's saturating `std::add_sat` in `<numeric>`.
- **Division:** integer division by zero is UB. `INT_MIN / -1` and `INT_MIN % -1` are UB because the quotient doesn't fit. `-INT_MIN` and `std::abs(INT_MIN)` are UB for the same reason.
- **Shifts:** a shift count that's negative or at least the (promoted) operand's width is UB. x86 and ARM shift instructions mask the count, so a runtime `1u << 32` often yields 1, but a constant-folded one can yield anything. Since C++20, `<<` on a negative value is defined (it wraps), and `>>` on a negative value is an arithmetic shift.
- **Conversions:** converting an out-of-range integer to a signed type has been defined (modulo 2^N) since C++20, so `static_cast<signed char>(255)` is -1. Converting an out-of-range floating-point value to an integer is UB (\[conv.fpint\]).
- **Pointer arithmetic** that leaves an array (other than to one past its end) is UB the moment the pointer is computed, before any dereference: see :sec[pointers-references-arrays/pointer-arithmetic-rules].

> **Coming from Go?** Go defines signed overflow to wrap and panics on integer division by zero. In C++ both are UB.

*Further reading:* [Signed integers](https://www.learncpp.com/cpp-tutorial/signed-integers/), [Numeric conversions](https://www.learncpp.com/cpp-tutorial/numeric-conversions/), [Bitwise operators](https://www.learncpp.com/cpp-tutorial/bitwise-operators/)

### Floating point in one paragraph

Assume IEEE 754 (check `std::numeric_limits<double>::is_iec559`). `0.1 + 0.2 != 0.3` because neither 0.1 nor 0.2 is exact in binary, while `0.5 + 0.25 == 0.75` is exact. `NaN != NaN`, and `-0.0 == 0.0`. Trading systems usually store prices as integer ticks or fixed-point `int64_t`, because floating-point rounding makes equality comparisons and summing order-dependent. Integer ticks move the risk to overflow: price × quantity can exceed `int64_t`, so check it, or compute it in `__int128` (a GCC/Clang extension).

*Further reading:* [Floating point numbers](https://www.learncpp.com/cpp-tutorial/floating-point-numbers/), [Relational operators and floating point comparisons](https://www.learncpp.com/cpp-tutorial/relational-operators-and-floating-point-comparisons/)

### Initialization

| Form | Example | Effect for `int` |
| --- | --- | --- |
| Default | `int x;` | Automatic storage: indeterminate. Static or thread storage: zero. |
| Value | `int x{};` or `int()` | Zero |
| Direct | `int x(5);` | 5, narrowing allowed |
| Copy | `int x = 5;` | 5, narrowing allowed |
| Direct-list | `int x{5};` | 5, narrowing is a compile error |
| Copy-list | `int x = {5};` | 5, narrowing is a compile error |

For a class type, default-initialization (`T x;`) calls the default constructor, and value-initialization (`T x{};`) zero-initializes the object first when that constructor isn't user-provided, then runs it. An *aggregate* (a plain struct or array, see :sec[classes/odds-and-ends]) initialized with braces copies each listed value into the next member in order; members without a value use their default member initializer, or are value-initialized (zero for scalars). So `Order o{};` zeroes every field, while `Order o;` leaves its `int` and `double` indeterminate at block scope.

- **Narrowing** means a conversion that may lose information: floating to integer, a wider integer to a narrower one (unless it's a constant that fits), or integer to floating point when the value might not be exact.
- **Most vexing parse:** `Timer t();` declares a function returning `Timer`, not an object. `Widget w(Gadget());` is also a function declaration. Braces fix both.
- **The `initializer_list` trap:** braces prefer an `initializer_list` constructor whenever one is viable, even when another constructor would match better. `std::vector<int> v(3, 7)` is `{7, 7, 7}`, but `std::vector<int> v{3, 7}` is `{3, 7}`.
- **`auto` with braces:** since C++17, `auto x{5}` is `int`, while `auto x = {5}` is `std::initializer_list<int>`.
- **Aggregates** can use designated initializers since C++20 (`Point p{.x = 1, .y = 2}`), and the designators must appear in declaration order.
- **Reading an uninitialized variable:** UB up to C++23 (the one exception: copying an indeterminate value through `unsigned char` or `std::byte` is allowed). In practice you get stale stack contents, or the optimizer deletes the path that reads it. GCC and Clang can already initialize every local with `-ftrivial-auto-var-init=zero` or `=pattern`. C++26 makes it *erroneous behavior* instead: the read yields some valid value, the program is wrong, and implementations are encouraged to diagnose it. `[[indeterminate]]` opts a variable out, restoring the old performance and UB. This applies only to automatic storage: objects with dynamic storage (new int) still start with indeterminate values, so reading them before initialization remains UB (\[basic.indet\]).

*Further reading:* [Variable assignment and initialization](https://www.learncpp.com/cpp-tutorial/variable-assignment-and-initialization/), [Uninitialized variables and undefined behavior](https://www.learncpp.com/cpp-tutorial/uninitialized-variables-and-undefined-behavior/), [Narrowing conversions, list initialization, and constexpr initializers](https://www.learncpp.com/cpp-tutorial/narrowing-conversions-list-initialization-and-constexpr-initializers/), [Introduction to std::vector and list constructors](https://www.learncpp.com/cpp-tutorial/introduction-to-stdvector-and-list-constructors/), [Struct aggregate initialization](https://www.learncpp.com/cpp-tutorial/struct-aggregate-initialization/)

### `auto` and `decltype`

`auto` deduces like a template parameter taken by value: it drops references and top-level `const`. Write `auto&`, `const auto&` or `auto&&` when you want a reference.

`decltype(x)` gives the declared type of the name `x`. `decltype((x))` treats `(x)` as an lvalue expression and gives `int&`. `decltype(auto)` deduces with `decltype` rules, which matters for returning references from forwarding functions.

*Further reading:* [Type deduction for objects using the auto keyword](https://www.learncpp.com/cpp-tutorial/type-deduction-for-objects-using-the-auto-keyword/), [Type deduction with pointers, references, and const](https://www.learncpp.com/cpp-tutorial/type-deduction-with-pointers-references-and-const/)

### The `const` family

| Keyword | Means | Runs at |
| --- | --- | --- |
| `const` | Read-only through this name | Can be initialized at runtime |
| `constexpr` variable | Constant expression, implies `const` | Compile time |
| `constexpr` function | *May* be evaluated at compile time | Either |
| `consteval` function | *Must* be evaluated at compile time | Compile time |
| `constinit` variable | Static initialization guaranteed (no init-order fiasco); not `const` | Compile time init, mutable after |

Modifying an object that was *defined* `const` is UB, even through `const_cast`. Casting away `const` is only safe when the original object wasn't `const`.

A useful property: core-language UB (signed overflow, invalid shifts, out-of-bounds pointer arithmetic, division by zero) disqualifies an expression from being a constant expression (\[expr.const\]), so the compiler must reject it in a constant-evaluated context. UB in the standard library is different: whether it's caught there is unspecified. Putting a test in a `static_assert` or `constexpr` context turns many silent bugs into compile errors: `constexpr int bad = INT_MAX + 1;` and `constexpr unsigned s = 1u << 32;` don't compile, and a `consteval` function that runs your edge cases fails the build if any of them hits UB.

*Further reading:* [Constant variables (named constants)](https://www.learncpp.com/cpp-tutorial/constant-variables-named-constants/), [Constexpr variables](https://www.learncpp.com/cpp-tutorial/constexpr-variables/), [Constexpr functions (part 3) and consteval](https://www.learncpp.com/cpp-tutorial/constexpr-functions-part-3-and-consteval/)

### Vocabulary and evaluation order

| Term | Meaning | Example |
| --- | --- | --- |
| Implementation-defined | Platform picks and must document | Signedness of `char`, `sizeof(long)` |
| Unspecified | Platform picks, needn't document or be consistent | Order of evaluating function arguments |
| Undefined | No requirements at all; optimizer assumes it never happens | Signed overflow, out-of-bounds access |
| Erroneous (C++26) | Defined but wrong; may be diagnosed | Reading an uninitialized `int` |

Evaluation order: since C++17, `a << b`, `a >> b`, `a[b]`, `a.b` and `a->b` evaluate `a` before `b` (which is what makes a chain of `std::cout << f() << g()` run `f` before `g`), and in `a = b` (and `a += b`) the right side, including all its side effects, is sequenced before the left side and the assignment (\[expr.assign\]). The operands of most other operators, such as `+`, `*` and `==`, are still unsequenced, evaluated in an unspecified order. Function arguments are *indeterminately sequenced*: each one is evaluated fully before the next starts, in an unspecified order, so two calls never interleave. Two unsequenced modifications of the same scalar, or a modification and a read, as in `i++ + i++`, are still UB (\[intro.execution\]).

*Further reading:* [Increment/decrement operators, and side effects](https://www.learncpp.com/cpp-tutorial/increment-decrement-operators-and-side-effects/), [Operator precedence and associativity](https://www.learncpp.com/cpp-tutorial/operator-precedence-and-associativity/)
