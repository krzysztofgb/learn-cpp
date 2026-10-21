### Where each feature is covered

| Standard | Feature | Covered in |
| --- | --- | --- |
| C++20 | Concepts, `consteval`, `constinit` | :mod[metaprogramming] |
| C++20 | Ranges, `std::span` | Modules :mod[containers]{bare}, :mod[algorithms-and-ranges]{bare} |
| C++20 | `jthread`, `latch`, `barrier`, semaphores, atomic wait | :mod[synchronization] |
| C++20 | Modules, coroutines, `<=>`, designated initializers, `[[likely]]`, `[[no_unique_address]]`, `std::format` | Here, and Modules :mod[classes]{bare}, :mod[utilities]{bare}, :mod[low-latency-techniques]{bare} |
| C++23 | `std::expected` | :mod[error-handling] |
| C++23 | Deducing `this`, `std::generator`, `std::print`, `flat_map`, `mdspan`, `std::stacktrace`, `std::unreachable`, `[[assume]]`, `start_lifetime_as`, `byteswap`, multidimensional `operator[]` | Here, and Modules :mod[raw-memory]{bare}, :mod[containers]{bare} |
| C++26 | Reflection, contracts, `std::execution`, hazard pointers, RCU, `std::simd`, `inplace_vector`, `function_ref`, pack indexing, `_` placeholder, `#embed`, erroneous behavior, hardened library, saturation arithmetic | Here, and Modules :mod[types-and-initialization]{bare}, :mod[containers]{bare}, :mod[utilities]{bare}, :mod[lock-free-programming]{bare}, :mod[async-models]{bare}, :mod[hardware]{bare} |

### Modules

`export module pricing;` declares a module interface; `import pricing;` uses it. Modules are compiled once into a binary module interface, so importing is faster than re-parsing headers; macros don't leak in or out; and only exported names are visible. C++23 adds `import std;`. Build system support (CMake 3.28+ with Ninja) works, but tooling and mixing with headers are still rough in practice.

### Coroutines

A function becomes a coroutine by using `co_await`, `co_yield` or `co_return`. The compiler turns it into a state machine whose locals live in a heap-allocated *coroutine frame* (the allocation can be elided if the compiler proves the frame doesn't outlive the caller). C++ coroutines are stackless: they can only suspend at `co_` points in the coroutine body itself, unlike goroutines, which have their own growable stacks and can block anywhere.

The machinery, defined by the return type's `promise_type`:

- `get_return_object()` creates what the caller receives (a generator, a task).
- `initial_suspend()` and `final_suspend()` decide whether to suspend at start and end.
- `yield_value(v)`, `return_value(v)` or `return_void()`, and `unhandled_exception()`.
- An *awaitable* has `await_ready()` (skip suspension?), `await_suspend(handle)` (what to do on suspension: schedule the handle somewhere, or return another handle for symmetric transfer), and `await_resume()` (the result of `co_await`).

The standard library provides only `std::generator` (C++23). Async task types come from libraries or C++26's `std::execution` integration. The biggest pitfall: reference parameters and captured references can dangle after a suspension, because the caller may have moved on.

### Three-way comparison

`a <=> b` returns `std::strong_ordering` (equal values are interchangeable: integers), `std::weak_ordering` (equivalent values may differ: case-insensitive strings), or `std::partial_ordering` (some values are unordered: floating point with NaN). Defaulting `operator<=>` compares members lexicographically and also gives you a defaulted `operator==`. The compiler rewrites `a < b` as `(a <=> b) < 0` and tries reversed operands, so one member function handles `int < Price` too, provided int converts implicitly to Price (through a non-explicit converting constructor). The reversed candidate is what allows the int on the left; verified on GCC 14 and Clang 18.

### Smaller C++20/23 features

- **Deducing `this`** (C++23): an explicit object parameter `void f(this Self&& self)` deduces the object's type and value category. It removes `const`/non-`const` duplication, enables recursive lambdas, and replaces most CRTP.
- **`[[likely]]`, `[[unlikely]]`** hint branch layout; **`[[assume(expr)]]`** (C++23) tells the optimizer `expr` is true; if it's false, behavior is undefined. **`std::unreachable()`** marks impossible paths, also UB if reached.
- **`auto(x)`** makes a decayed prvalue copy; **static `operator()`** makes stateless function objects cheaper to call.
- **`std::stacktrace`** captures the call stack at runtime; **`std::to_underlying`** converts enums.

### C++26 highlights for trading

- **Static reflection (P2996):** `^^T` produces a `std::meta::info` describing `T`; functions like `std::meta::nonstatic_data_members_of` query it; splicers `[: r :]` turn it back into code; expansion statements (`template for`) loop over members at compile time. Uses: automatic serialization of message structs, enum-to-string, generating decoders, all without macros or code generators.
- **Contracts (P2900):** `pre`, `post` and `contract_assert`, checked according to a build-selected semantic (:mod[error-handling]).
- **`std::execution` (P2300):** senders and receivers for structured asynchronous code (:mod[async-models]).
- **Hazard pointers and RCU:** standard safe memory reclamation for lock-free structures (:mod[lock-free-programming]).
- **`std::simd`:** portable data-parallel types (:mod[hardware]).
- **Smaller:** `std::inplace_vector`, `std::function_ref`, pack indexing `Ts...[0]`, `_` as a placeholder you can declare repeatedly, `#embed` for binary files, `= delete("reason")`, saturation arithmetic (`std::add_sat`), erroneous behavior for uninitialized reads, and a hardened standard library mode with bounds-checked `operator[]`.
