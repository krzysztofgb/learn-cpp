# Module 13: Utilities

These vocabulary types (`optional`, `variant`, `function`, lambdas, `chrono`) appear in every codebase. Interview questions focus on how they're implemented and what they cost.

## Notes

### 13.1 Tuples and structured bindings

`auto [a, b] = expr;` creates one hidden object initialized from `expr` (a copy, with plain `auto`), and `a` and `b` are names for its parts. `auto& [a, b] = obj;` binds to `obj` itself. Structured bindings work with public data members, arrays, and tuple-like types (`std::tuple_size` and `get`). C++26 adds structured binding packs and declarations as conditions.

### 13.2 `optional`

A value or nothing, stored inline (no allocation): size is `sizeof(T)` plus a flag, padded. `value()` throws `std::bad_optional_access`; `*` and `->` are unchecked (UB when empty). Monadic `and_then`, `transform` and `or_else` arrived in C++23. Use it for "may be absent" returns instead of sentinel values or out-parameters.

### 13.3 `variant`

A type-safe tagged union of a fixed set of alternatives: size is the largest alternative plus a discriminator, padded.

- `index()` gives the active alternative; `std::get<T>` throws `std::bad_variant_access` if wrong; `std::get_if<T>(&v)` returns a pointer or null.
- `std::visit` dispatches on the active type, typically through a jump table or `switch` generated at compile time. The `overloaded` idiom builds a visitor from lambdas: `template <class... Ts> struct overloaded : Ts... { using Ts::operator()...; };`
- A default-constructed variant holds the first alternative; use `std::monostate` first if that isn't default-constructible or you want an "empty" state.
- If an exception is thrown while switching alternatives, the variant can become `valueless_by_exception()`.
- Converting assignment from `"abc"` to `variant<std::string, bool>` picks `std::string` since C++20 (P0608); before that it picked `bool` because pointer-to-bool is a standard conversion.

### 13.4 Callables: lambdas and `std::function`

A lambda creates an object of a unique unnamed class with an `operator()`. Captures become members: `[x]` by value (copied at creation), `[&x]` by reference, `[y = std::move(z)]` init-capture, `[this]` captures the pointer (dangles if the object dies), `[*this]` copies the object (C++17). The call operator is `const` unless the lambda is `mutable`. A captureless lambda converts to a function pointer.

`std::function<R(Args...)>` is a type-erased, copyable wrapper: it stores any callable, using a small internal buffer for small ones (size implementation-defined) and the heap for larger ones, and calls through an indirect pointer. Calling an empty one throws `std::bad_function_call`. Alternatives: a template parameter (inlinable, no erasure), `std::move_only_function` (C++23, holds move-only callables), and `std::function_ref` (C++26, non-owning, never allocates).

### 13.5 `chrono`

Durations (`std::chrono::nanoseconds`), time points, and clocks. Use `steady_clock` for measuring intervals: it's monotonic. `system_clock` is wall time and can jump (NTP, manual changes). `high_resolution_clock` is just an alias for one of them; don't use it. `duration_cast` truncates toward zero; `floor`, `ceil` and `round` do what they say. C++20 added calendars and time zones.

### 13.6 Small but useful

- `std::format` (C++20) and `std::print` (C++23): type-safe, with format strings checked at compile time.
- `<bit>`: `popcount`, `countl_zero`, `countr_zero`, `bit_ceil`, `has_single_bit`, `rotl`, `byteswap`.
- `<random>`: `std::mt19937_64` engine (about 2.5 KB of state), seeded from `std::random_device`; distributions are not portable across standard libraries, so the same seed gives different sequences on libc++ and libstdc++. Avoid `rand()`.
- `std::any`: type-erased single value with heap storage for larger types. Rarely the right tool.

## Predict the output

**P1**

```cpp kind=fragment run=local
std::pair<int, int> p{1, 2};
auto [a, b] = p;
a = 10;
cout << p.first;
auto& [c, d] = p;
c = 10;
cout << p.first;
```

**P2**

```cpp kind=fragment run=local
std::variant<std::string, bool> v = "abc";
cout << v.index();    // compiled as C++20
```

**P3**

```cpp kind=fragment run=local
std::optional<int> a, b = 0;
cout << (a < b) << (a == std::nullopt) << (b == 0);
```

**P4**

```cpp kind=fragment run=local
int x = 1;
auto f = [x] { return x; };
auto g = [&x] { return x; };
x = 2;
cout << f() << g();
```

**P5**

```cpp kind=fragment run=local
auto counter = [n = 0]() mutable { return ++n; };
auto copy = counter;
counter(); counter();
cout << copy() << counter();
```

**P6**

```cpp kind=fragment run=local
using namespace std::chrono;
cout << duration_cast<milliseconds>(1999us).count() << ' '
     << round<milliseconds>(1999us).count();
```

## Spot the bug or UB

**U1**

```cpp kind=fragment run=none
class Strategy {
    Timer& timer_;
public:
    void start() { timer_.every(1ms, [this] { on_tick(); }); }
    void on_tick();
};
// a Strategy is destroyed while its timer keeps running
```

**U2**

```cpp kind=fragment run=local
auto make_adder(int n) {
    return [&n](int x) { return x + n; };
}
```

**U3**

```cpp kind=fragment run=none
std::string_view label = std::format("{}-{}", venue, symbol);
```

**U4**

```cpp kind=fragment run=none
auto t0 = std::chrono::system_clock::now();
process(order);
auto latency = std::chrono::system_clock::now() - t0;
```

**U5**

```cpp kind=fragment run=local
std::mt19937 rng(42);
std::uniform_int_distribution<std::uint8_t> byte(0, 255);
auto b = byte(rng);
```

## Exercises

**E1 ★ Event visitor.** Model market events as `std::variant<Add, Cancel, Modify, Trade>` and process a vector of them with `std::visit` and the `overloaded` idiom. Make it a compile error to forget a case.

**E2 ★★ `Function<R(Args...)>`.** Implement a type-erased callable with a 32-byte small buffer and heap fallback, supporting copy and move. Compare `sizeof` and call cost against `std::function` and a template parameter in a tight loop.

**E3 ★★ Latency timer.** Write an RAII `ScopedTimer` that records `steady_clock` elapsed nanoseconds into a fixed array of logarithmic buckets, and a report function printing p50 and p99 estimates with `std::format`.

**E4 ★★ `Expected<T, E>`.** Implement a minimal version with `has_value`, `value` (throws), `error`, `operator*`, `and_then` and `transform`. Keep it allocation-free.

**E5 ★★★ Two-type variant.** Implement `Variant2<A, B>` with correct construction, destruction, copy, move, assignment between alternatives, and a `visit`. Then generalize the index dispatch to N types with a fold expression or a function-pointer table.

## Interview questions

1. When would you return `std::optional<T>` vs a pointer vs a sentinel value?
2. How is `std::variant` laid out, and how does `std::visit` dispatch?
3. What does `std::function` cost compared to a template parameter or function pointer?
4. What is a lambda's closure type? How are captures stored?
5. What are the dangers of capturing `this`?
6. `steady_clock` vs `system_clock`: which do you use to measure latency, and why?
7. When is `std::any` appropriate?
8. What do structured bindings actually bind to?
9. Why might the same `<random>` code produce different numbers on two machines?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `110` | `auto [a, b]` binds to a copy; `auto& [c, d]` binds to `p`. |
| P2 | `0` | C++20 picks `std::string`; earlier standards picked `bool` (index 1). |
| P3 | `111` | An empty optional compares less than any value. |
| P4 | `12` | `f` copied 1 at creation; `g` reads `x` at call time. |
| P5 | `13` | `copy` has its own `n`, copied when it was 0. |
| P6 | `1 2` | `duration_cast` truncates; `round` rounds to nearest. |

### Spot the bug or UB

- **U1:** The timer calls the lambda after the `Strategy` is destroyed: `this` dangles, UB. Cancel the timer in the destructor, or capture a `weak_ptr` and lock it.
- **U2:** UB on call: `n` is a parameter that dies when `make_adder` returns. Capture by value: `[n]`.
- **U3:** UB on use: `std::format` returns a temporary `std::string`, which dies at the semicolon. Store a `std::string`.
- **U4:** Not UB, but `system_clock` can jump backward or forward, giving negative or huge latencies. Use `steady_clock`.
- **U5:** UB: `uniform_int_distribution` only allows `short`, `int`, `long`, `long long` and their unsigned versions, not character types. Generate an `int` in \[0, 255\] and convert.

### Exercise hints

- **E1:** A visitor missing an alternative fails to compile with `std::visit`, as long as you don't add a generic `auto` catch-all.
- **E2:** Store a pointer to a static "vtable" struct with `invoke`, `copy`, `move` and `destroy` function pointers for the stored type.
- **E5:** For N types, build a `constexpr` array of function pointers indexed by `index()`, one instantiation per alternative.

### Interview questions

1. `optional` when absence is a normal outcome and the value is small; a pointer when referring to an existing object that may not exist (non-owning); a sentinel only when a value is naturally impossible and documented.
2. Storage big enough for the largest alternative plus an index, padded. `visit` uses a compile-time generated table or switch indexed by `index()` (for multiple variants, a multidimensional table).
3. Type erasure: an indirect call that can't be inlined, a possible heap allocation for large callables, and a larger object (32 or 48 bytes). A template parameter is fully inlinable; a function pointer is an indirect call without state.
4. A unique unnamed class type; by-value captures are data members, by-reference captures are references or pointers, and `operator()` is the body.
5. The lambda doesn't keep the object alive. If it runs later (timers, async callbacks, other threads), `this` may dangle. Use `[*this]`, a `weak_ptr`, or guaranteed cancellation.
6. `steady_clock`: monotonic, unaffected by wall-clock adjustments. `system_clock` is for timestamps that must match real time.
7. Rarely: heterogeneous storage where the set of types is open and unknown at compile time, like generic property bags. Usually `variant` or a proper interface is better.
8. To members of one hidden object initialized from the expression (a copy for `auto`, a reference for `auto&`). The names are aliases, not separate variables.
9. Engines like `mt19937` are fully specified, but distributions aren't: libc++ and libstdc++ implement them differently. For reproducible simulations, implement the distribution yourself.
