# Module 16: C++20 through C++26

Interviewers increasingly ask what modern features you've used and which C++26 additions matter for trading. This module surveys the features not covered elsewhere and goes deep on the two most-asked: coroutines and `<=>`. Compiler support for C++26 is partial; check the compiler support table on cppreference before relying on a feature.

## Notes

### 16.1 Where each feature is covered

| Standard | Feature | Covered in |
| --- | --- | --- |
| C++20 | Concepts, `consteval`, `constinit` | Module 15 |
| C++20 | Ranges, `std::span` | Modules 11, 12 |
| C++20 | `jthread`, `latch`, `barrier`, semaphores, atomic wait | Module 17 |
| C++20 | Modules, coroutines, `<=>`, designated initializers, `[[likely]]`, `[[no_unique_address]]`, `std::format` | Here, and Modules 4, 13, 22 |
| C++23 | `std::expected` | Module 7 |
| C++23 | Deducing `this`, `std::generator`, `std::print`, `flat_map`, `mdspan`, `std::stacktrace`, `std::unreachable`, `[[assume]]`, `start_lifetime_as`, `byteswap`, multidimensional `operator[]` | Here, and Modules 10, 11 |
| C++26 | Reflection, contracts, `std::execution`, hazard pointers, RCU, `std::simd`, `inplace_vector`, `function_ref`, pack indexing, `_` placeholder, `#embed`, erroneous behavior, hardened library, saturation arithmetic | Here, and Modules 1, 11, 13, 19, 20, 21 |

### 16.2 Modules

`export module pricing;` declares a module interface; `import pricing;` uses it. Modules are compiled once into a binary module interface, so importing is faster than re-parsing headers; macros don't leak in or out; and only exported names are visible. C++23 adds `import std;`. Build system support (CMake 3.28+ with Ninja) works, but tooling and mixing with headers are still rough in practice.

### 16.3 Coroutines

A function becomes a coroutine by using `co_await`, `co_yield` or `co_return`. The compiler turns it into a state machine whose locals live in a heap-allocated *coroutine frame* (the allocation can be elided if the compiler proves the frame doesn't outlive the caller). C++ coroutines are stackless: they can only suspend at `co_` points in the coroutine body itself, unlike goroutines, which have their own growable stacks and can block anywhere.

The machinery, defined by the return type's `promise_type`:

- `get_return_object()` creates what the caller receives (a generator, a task).
- `initial_suspend()` and `final_suspend()` decide whether to suspend at start and end.
- `yield_value(v)`, `return_value(v)` or `return_void()`, and `unhandled_exception()`.
- An *awaitable* has `await_ready()` (skip suspension?), `await_suspend(handle)` (what to do on suspension: schedule the handle somewhere, or return another handle for symmetric transfer), and `await_resume()` (the result of `co_await`).

The standard library provides only `std::generator` (C++23). Async task types come from libraries or C++26's `std::execution` integration. The biggest pitfall: reference parameters and captured references can dangle after a suspension, because the caller may have moved on.

### 16.4 Three-way comparison

`a <=> b` returns `std::strong_ordering` (equal values are interchangeable: integers), `std::weak_ordering` (equivalent values may differ: case-insensitive strings), or `std::partial_ordering` (some values are unordered: floating point with NaN). Defaulting `operator<=>` compares members lexicographically and also gives you a defaulted `operator==`. The compiler rewrites `a < b` as `(a <=> b) < 0` and tries reversed operands, so one member function handles `int < Price` too, provided int converts implicitly to Price (through a non-explicit converting constructor). The reversed candidate is what allows the int on the left; verified on GCC 14 and Clang 18.

### 16.5 Smaller C++20/23 features

- **Deducing `this`** (C++23): an explicit object parameter `void f(this Self&& self)` deduces the object's type and value category. It removes `const`/non-`const` duplication, enables recursive lambdas, and replaces most CRTP.
- **`[[likely]]`, `[[unlikely]]`** hint branch layout; **`[[assume(expr)]]`** (C++23) tells the optimizer `expr` is true; if it's false, behavior is undefined. **`std::unreachable()`** marks impossible paths, also UB if reached.
- **`auto(x)`** makes a decayed prvalue copy; **static `operator()`** makes stateless function objects cheaper to call.
- **`std::stacktrace`** captures the call stack at runtime; **`std::to_underlying`** converts enums.

### 16.6 C++26 highlights for trading

- **Static reflection (P2996):** `^^T` produces a `std::meta::info` describing `T`; functions like `std::meta::nonstatic_data_members_of` query it; splicers `[: r :]` turn it back into code; expansion statements (`template for`) loop over members at compile time. Uses: automatic serialization of message structs, enum-to-string, generating decoders, all without macros or code generators.
- **Contracts (P2900):** `pre`, `post` and `contract_assert`, checked according to a build-selected semantic (Module 7).
- **`std::execution` (P2300):** senders and receivers for structured asynchronous code (Module 20).
- **Hazard pointers and RCU:** standard safe memory reclamation for lock-free structures (Module 19).
- **`std::simd`:** portable data-parallel types (Module 21).
- **Smaller:** `std::inplace_vector`, `std::function_ref`, pack indexing `Ts...[0]`, `_` as a placeholder you can declare repeatedly, `#embed` for binary files, `= delete("reason")`, saturation arithmetic (`std::add_sat`), erroneous behavior for uninitialized reads, and a hardened standard library mode with bounds-checked `operator[]`.

## Predict the output

**P1**

```cpp kind=fragment run=local
struct V {
    int a, b;
    auto operator<=>(const V&) const = default;
};
cout << (V{1, 5} < V{2, 0}) << (V{1, 5} == V{1, 5});
```

**P2**

```cpp kind=fragment run=local
auto r = 1.0 <=> std::nan("");
cout << (r == std::partial_ordering::unordered)
     << (1.0 < std::nan(""))
     << (1.0 >= std::nan(""));
```

**P3**

```cpp kind=fragment run=local
struct S {
    void who(this auto&& self) {
        using Self = std::remove_reference_t<decltype(self)>;
        cout << (std::is_const_v<Self> ? 'c' : 'm');
    }
};
S s; const S cs;
s.who(); cs.who(); S{}.who();
```

**P4**

```cpp kind=fragment run=none
std::generator<int> nums() {
    for (int i = 0;; ++i) { cout << 'y'; co_yield i; }
}
for (int x : nums() | std::views::take(3)) cout << x;
```

**P5**

```cpp kind=fragment run=local
struct P { int x, y, z; };
P p{.x = 1, .z = 3};
cout << p.y;
// P q{.y = 1, .x = 2};   // what happens if uncommented?
```

**P6**

```cpp kind=fragment run=local
struct Price {
    long ticks;
    auto operator<=>(const Price&) const = default;
};
std::vector<Price> v{{3}, {1}, {2}};
std::ranges::sort(v);
cout << v.front().ticks << (Price{2} != Price{3});
```

## Spot the bug or UB

**U1**

```cpp kind=fragment run=none
Task<void> handle(const std::string& msg) {
    co_await network.send(encode(msg));
    log(msg);
}
// called as: handle(build_message());
```

**U2**

```cpp kind=fragment run=local
int scale(int x) {
    [[assume(x > 0)]];
    return 100 / x;
}
scale(0);
```

**U3**

```cpp kind=fragment run=local
enum class Side : char { Buy = 'B', Sell = 'S' };
const char* name(Side s) {
    switch (s) {
        case Side::Buy: return "buy";
        case Side::Sell: return "sell";
    }
    std::unreachable();
}
name(static_cast<Side>('X'));
```

**U4**

```cpp kind=fragment run=local
struct Quote {
    double bid, ask;
    std::mutex m;
    auto operator<=>(const Quote&) const = default;
};
Quote a, b;
bool less = a < b;
```

**U5**

```cpp kind=fragment run=none
int validated = 0;
void submit(const Order& o) pre(++validated > 0);
```

## Exercises

**E1 ★ `<=>` in practice.** Give `Price` (ticks) and `Order` (price, time, id) defaulted comparisons, then a custom `<=>` for bid priority (higher price first, earlier time first). Verify sorting with `std::ranges::sort`.

**E2 ★★ Generator from scratch.** Implement `Generator<T>` with a `promise_type`, iterator and sentinel, and use it to stream parsed messages from a buffer. Then compare with `std::generator`.

**E3 ★★ Awaitable task.** Implement a minimal `Task<T>` that starts suspended and resumes its awaiting coroutine on completion via symmetric transfer (`await_suspend` returning a `coroutine_handle`). Chain three tasks. Verify with ASan that frames are destroyed.

**E4 ★★ Deducing `this`.** Remove `const`/non-`const` duplication from a container's `at()` and `operator[]`, and write a recursive lambda computing Fibonacci without `std::function`.

**E5 ★★★ Reflection.** On Compiler Explorer with a reflection-enabled Clang or GCC trunk (`-freflection` or equivalent), write `enum_to_string` and a function that prints every field of an arbitrary aggregate as `name=value`.

**E6 ★★ Contracts.** With a contracts-enabled compiler on Compiler Explorer, annotate an order validation function with `pre` and `post`, and observe behavior under the ignore, observe and enforce semantics.

## Interview questions

1. What does `<=>` give you, and what are the three ordering categories?
2. How do C++ coroutines work? What does the compiler generate?
3. Coroutines vs threads vs goroutines?
4. What's dangerous about reference parameters in coroutines?
5. What problem does deducing `this` solve?
6. What do modules improve over headers?
7. Which C++26 features matter most for low-latency trading, and why?
8. What is static reflection useful for?
9. What's the difference between `[[likely]]` and `[[assume]]`?
10. What is erroneous behavior?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `11` | Lexicographic by `a`, then `b`; defaulted `<=>` also gives `==`. |
| P2 | `100` | NaN is unordered: all relational comparisons are false. |
| P3 | `mcm` | `self` deduces `S&`, `const S&` and `S&&`. |
| P4 | `y0y1y2y` | A generator isn't a sized range, so `take_view::begin()` returns `counted_iterator(ranges::begin(base_), count_)` (\[range.take.view\]). `counted_iterator::operator++` is specified as `++current; --length;` (\[counted.iter.nav\]), so the step that drops the count to 0 still resumes the generator, printing a fourth `y`. Verified with GCC 14. |
| P5 | `0`; uncommented: compile error | Unnamed members are value-initialized; designators must follow declaration order. |
| P6 | `11` | Defaulted `<=>` makes `Price` sortable; `!=` is rewritten as `!(==)`. |

### Spot the bug or UB

- **U1:** The temporary `std::string` dies when `handle(...)` returns at the first suspension, so `log(msg)` reads a dangling reference. Take `std::string` by value in coroutines.
- **U2:** UB: the assumption is false when `x` is 0, so the optimizer may have removed checks based on it. `[[assume]]` is a promise, not an assertion.
- **U3:** UB: `std::unreachable()` is reached for an out-of-range enum value. Validate input from the wire before converting to the enum.
- **U4:** Doesn't compile: `std::mutex` has no `<=>`, so the defaulted operator is deleted.
- **U5:** Contract predicates may be evaluated zero, one, or more times depending on the semantic, so side effects make behavior unpredictable. \[basic.contract.eval\] lets an implementation re-evaluate assertions within a sequence (its Example 3 lists #1 #1 #2 #2 as a valid evaluation order) and skips the predicate entirely under the ignore semantic. Predicates must be side-effect free.

### Exercise hints

- **E3:** In `final_suspend`, return an awaiter whose `await_suspend` returns the continuation handle; that's symmetric transfer, and it avoids stack growth when chaining.
- **E5:** Use `template for (constexpr auto m : std::define_static_array(nonstatic_data_members_of(^^T, std::meta::access_context::unchecked())))` and splice `obj.[:m:]`; exact names vary across implementations.

### Interview questions

1. One operator generating all relational comparisons, with rewritten and reversed candidates. Strong (substitutable equality), weak (equivalence without substitutability), partial (incomparable values exist).
2. The function body becomes a state machine; locals move into a heap frame; the return type's `promise_type` controls creation, suspension, results and exceptions; `co_await` calls the awaitable's three hooks.
3. Threads are OS-scheduled with their own stacks (MB-scale, microsecond switches). Goroutines are runtime-scheduled with small growable stacks and can block anywhere. C++ coroutines are stackless state machines that suspend only at `co_` points, costing a frame allocation and nanoseconds to switch, but need an external scheduler.
4. The caller's arguments may be destroyed while the coroutine is suspended, so references dangle on resumption.
5. Writing one member function for all cv/ref qualifications of `this`, recursive lambdas, and static polymorphism without CRTP.
6. Faster builds (parse once), isolation from macros, explicit exports, no ODR issues from include order.
7. Reflection (serialization and decoders without codegen), `std::execution` (structured async), hazard pointers/RCU (lock-free reclamation), `std::simd` (portable vectorization), `inplace_vector` (no-alloc containers), contracts and hardening (safety).
8. Generating code from type structure at compile time: serializers, parsers, enum names, ORMs, comparison and hashing.
9. `[[likely]]` only influences code layout and has no semantic effect. `[[assume]]` gives the optimizer a fact; if it's false, behavior is undefined.
10. A new category in C++26: the behavior is well-defined (for example, an uninitialized read gives some value) but the program is incorrect, and implementations are encouraged to diagnose it. It replaces UB for uninitialized locals.
