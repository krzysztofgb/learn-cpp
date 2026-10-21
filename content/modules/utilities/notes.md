### Tuples and structured bindings

`auto [a, b] = expr;` creates one hidden object initialized from `expr` (a copy, with plain `auto`), and `a` and `b` are names for its parts. `auto& [a, b] = obj;` binds to `obj` itself. Structured bindings work with public data members, arrays, and tuple-like types (`std::tuple_size` and `get`). C++26 adds structured binding packs and declarations as conditions.

### `optional`

A value or nothing, stored inline (no allocation): size is `sizeof(T)` plus a flag, padded. `value()` throws `std::bad_optional_access`; `*` and `->` are unchecked (UB when empty). Monadic `and_then`, `transform` and `or_else` arrived in C++23. Use it for "may be absent" returns instead of sentinel values or out-parameters.

### `variant`

A type-safe tagged union of a fixed set of alternatives: size is the largest alternative plus a discriminator, padded.

- `index()` gives the active alternative; `std::get<T>` throws `std::bad_variant_access` if wrong; `std::get_if<T>(&v)` returns a pointer or null.
- `std::visit` dispatches on the active type, typically through a jump table or `switch` generated at compile time. The `overloaded` idiom builds a visitor from lambdas: `template <class... Ts> struct overloaded : Ts... { using Ts::operator()...; };`
- A default-constructed variant holds the first alternative; use `std::monostate` first if that isn't default-constructible or you want an "empty" state.
- If an exception is thrown while switching alternatives, the variant can become `valueless_by_exception()`.
- Converting assignment from `"abc"` to `variant<std::string, bool>` picks `std::string` since C++20 (P0608); before that it picked `bool` because pointer-to-bool is a standard conversion.

### Callables: lambdas and `std::function`

A lambda creates an object of a unique unnamed class with an `operator()`. Captures become members: `[x]` by value (copied at creation), `[&x]` by reference, `[y = std::move(z)]` init-capture, `[this]` captures the pointer (dangles if the object dies), `[*this]` copies the object (C++17). The call operator is `const` unless the lambda is `mutable`. A captureless lambda converts to a function pointer.

`std::function<R(Args...)>` is a type-erased, copyable wrapper: it stores any callable, using a small internal buffer for small ones (size implementation-defined) and the heap for larger ones, and calls through an indirect pointer. Calling an empty one throws `std::bad_function_call`. Alternatives: a template parameter (inlinable, no erasure), `std::move_only_function` (C++23, holds move-only callables), and `std::function_ref` (C++26, non-owning, never allocates).

### `chrono`

Durations (`std::chrono::nanoseconds`), time points, and clocks. Use `steady_clock` for measuring intervals: it's monotonic. `system_clock` is wall time and can jump (NTP, manual changes). `high_resolution_clock` is just an alias for one of them; don't use it. `duration_cast` truncates toward zero; `floor`, `ceil` and `round` do what they say. C++20 added calendars and time zones.

### Small but useful

- `std::format` (C++20) and `std::print` (C++23): type-safe, with format strings checked at compile time.
- `<bit>`: `popcount`, `countl_zero`, `countr_zero`, `bit_ceil`, `has_single_bit`, `rotl`, `byteswap`.
- `<random>`: `std::mt19937_64` engine (about 2.5 KB of state), seeded from `std::random_device`; distributions are not portable across standard libraries, so the same seed gives different sequences on libc++ and libstdc++. Avoid `rand()`.
- `std::any`: type-erased single value with heap storage for larger types. Rarely the right tool.
