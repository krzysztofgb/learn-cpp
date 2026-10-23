### Tuples and structured bindings

`auto [a, b] = expr;` creates one hidden object initialized from `expr` (a copy, with plain `auto`), and `a` and `b` are names for its parts. `auto& [a, b] = obj;` binds to `obj` itself. Structured bindings work with public data members, arrays, and tuple-like types (`std::tuple_size` and `get`). C++26 adds structured binding packs and declarations as conditions.

### `optional`

A value or nothing, stored inline (no allocation): size is `sizeof(T)` plus a flag, padded. `value()` throws `std::bad_optional_access`; `*` and `->` are unchecked (UB when empty). Monadic `and_then`, `transform` and `or_else` arrived in C++23. Use it for "may be absent" returns instead of sentinel values or out-parameters. Compared with the alternatives: a pointer is the right type when you refer to an existing object that may not exist (it doesn't own and doesn't copy), and a sentinel value (`-1`, `NaN`) only when that value is naturally impossible and documented.

Comparisons treat an empty optional as smaller than any engaged one, and two empties as equal; an engaged optional compares with a plain `T` by comparing its value (`opt == 0` is false when `opt` is empty), and `opt == std::nullopt` tests for emptiness.

*Further reading:* [std::optional](https://www.learncpp.com/cpp-tutorial/stdoptional/)

### `expected`

C++23's `std::expected<T, E>` holds either a value or an error, inline, with no allocation: the error-returning counterpart of `optional`. `has_value()` (or `operator bool`) says which; `*` and `->` are unchecked; `value()` throws `std::bad_expected_access<E>` when it holds an error; `error()` reads the error. Return an error with `return std::unexpected(e);`. Like `optional` it has monadic operations: `and_then` (chain a step that itself returns an `expected`), `transform` (map the value), `or_else` and `transform_error` (act on the error). :mod[error-handling] covers when to prefer it to exceptions.

*Further reading:* [std::expected on cppreference](https://en.cppreference.com/w/cpp/utility/expected)

### `variant`

A type-safe tagged union of a fixed set of alternatives: size is the largest alternative plus a discriminator, padded. Internally it's a union (or suitably aligned bytes) plus the index: constructing an alternative uses placement-new into the storage and records its index, and the destructor, copy and move each dispatch on the index to call the right member function of the live alternative.

- `index()` gives the active alternative; `std::get<T>` throws `std::bad_variant_access` if wrong; `std::get_if<T>(&v)` returns a pointer or null.
- `std::visit(visitor, v)` calls the visitor with the active alternative. Implementations generate, at compile time, one function per alternative and dispatch through a table of function pointers (or a `switch`) indexed by `index()`; with several variants, `visit(f, v1, v2)` uses a multidimensional table over every combination. The visitor must be callable with every alternative, or the `visit` call doesn't compile, which makes a missed case a compile error unless a generic `[](auto&)` overload catches everything.
- The `overloaded` idiom builds a visitor from lambdas: `template <class... Ts> struct overloaded : Ts... { using Ts::operator()...; };`, used as `std::visit(overloaded{[](Add&) {…}, [](Cancel&) {…}}, ev)`.
- A default-constructed variant holds the first alternative; use `std::monostate` first if that isn't default-constructible or you want an "empty" state.
- If an exception is thrown while switching alternatives, the variant can become `valueless_by_exception()`.
- Converting assignment from `"abc"` to `variant<std::string, bool>` picks `std::string` since C++20 (P0608); before that it picked `bool` because pointer-to-bool is a standard conversion.

*Further reading:* [std::variant on cppreference](https://en.cppreference.com/w/cpp/utility/variant)

### Callables: lambdas and `std::function`

A lambda creates an object of a unique unnamed class (its *closure type*) with an `operator()` whose body is the lambda's body. Captures become members: `[x]` by value (copied at creation, so later changes to `x` aren't seen), `[&x]` by reference (reads `x` at call time; whether a member exists for it is unspecified, but in practice it's a pointer), `[y = std::move(z)]` init-capture, `[this]` captures the pointer, `[*this]` copies the object (C++17). The call operator is `const` unless the lambda is `mutable`, which lets the body modify its by-value captures. Copying a lambda copies its captures, so a copied `mutable` lambda has its own independent state from the moment of the copy. A captureless lambda converts to a function pointer.

A lambda doesn't extend the life of anything it captures by reference or through `this`. Capturing a local or a parameter by reference and returning or storing the lambda leaves a dangling reference; `[this]` dangles if the lambda runs (on a timer, another thread, a later callback) after the object is destroyed. Fixes: capture by value, use `[*this]`, cancel the callback in the destructor, or capture a `std::weak_ptr` (from `shared_from_this()`) and `lock()` it before use.

`std::function<R(Args...)>` is a type-erased, copyable wrapper: it stores any callable, using a small internal buffer for small ones (size implementation-defined) and the heap for larger ones, and calls through an indirect pointer. `sizeof(std::function<void()>)` is 32 bytes in libstdc++, 48 in libc++ and 64 in MSVC (on 64-bit targets). Calling an empty one throws `std::bad_function_call`. Type erasure in general works like this: a template constructor knows the concrete type, so it stores the object (in the buffer or on the heap) together with a pointer to a static table of functions instantiated for that type (invoke, copy, move, destroy); every later operation goes through that table. The cost is an indirect call the compiler usually can't inline, possibly an allocation, and a larger object. Alternatives: a template parameter (inlinable, no erasure), a plain function pointer (indirect call, no state), `std::move_only_function` (C++23, holds move-only callables), and `std::function_ref` (C++26, non-owning, never allocates).

*Further reading:* [Introduction to lambdas (anonymous functions)](https://www.learncpp.com/cpp-tutorial/introduction-to-lambdas-anonymous-functions/), [Lambda captures](https://www.learncpp.com/cpp-tutorial/lambda-captures/), [Function Pointers](https://www.learncpp.com/cpp-tutorial/function-pointers/)

### `chrono`

Durations (`std::chrono::nanoseconds`), time points, and clocks. Use `steady_clock` for measuring intervals: it's monotonic. `system_clock` is wall time and can jump (NTP, manual changes), so differences between two readings can be negative or huge; use it only for timestamps that must match real time. `high_resolution_clock` is just an alias for one of them; don't use it. `duration_cast` truncates toward zero; `floor`, `ceil` and `round` do what they say (`round` breaks ties to even). C++20 added calendars and time zones.

*Further reading:* [Timing your code](https://www.learncpp.com/cpp-tutorial/timing-your-code/)

### Small but useful

- `std::format` (C++20) and `std::print` (C++23): type-safe, with format strings checked at compile time. `std::format` returns a new `std::string` by value, so a `string_view` initialized from it dangles at the end of the statement; `std::format_to` and `std::format_to_n` write into an existing buffer instead.
- `<bit>`: `popcount`, `countl_zero`, `countr_zero`, `bit_ceil`, `has_single_bit`, `rotl`, `byteswap`.
- `<random>`: `std::mt19937_64` engine (about 2.5 KB of state), seeded from `std::random_device`. Engines are fully specified, so a given seed produces the same raw sequence everywhere; distributions are not, so the same seed gives different distributed values on libc++ and libstdc++. `uniform_int_distribution<IntType>` is only defined for `short`, `int`, `long`, `long long` and their unsigned versions: `char`, `signed char`, `unsigned char`, `std::uint8_t` and `bool` are UB (\[rand.req.genl\]). Avoid `rand()`.
- `std::any`: type-erased single value with heap storage for larger types, read back with `std::any_cast<T>`. Useful only when the set of types is open and unknown at compile time; for a closed set, `variant` is smaller, faster and checked.

*Further reading:* [Introduction to random number generation](https://www.learncpp.com/cpp-tutorial/introduction-to-random-number-generation/), [Generating random numbers using Mersenne Twister](https://www.learncpp.com/cpp-tutorial/generating-random-numbers-using-mersenne-twister/)
