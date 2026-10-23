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

Because an import isn't affected by macros or declarations that precede it, import order doesn't matter. A header, by contrast, is re-parsed in every translation unit that includes it, possibly under different macro settings or after different earlier includes, and two translation units that end up seeing different definitions of the same entity violate the one-definition rule with no diagnostic. A module interface is compiled once, so every importer sees the same declarations.

### Coroutines

A function becomes a coroutine by using `co_await`, `co_yield` or `co_return`. The compiler turns it into a state machine whose locals live in a heap-allocated *coroutine frame* (the allocation can be elided if the compiler proves the frame doesn't outlive the caller). C++ coroutines are *stackless*: they can only suspend at `co_` points in the coroutine body itself, not from inside a function the body calls. *Stackful* coroutines (fibers, such as Boost.Context) each own a stack and can suspend from any depth, at the cost of that stack's memory. Both are far cheaper than threads: an OS thread has its own stack (typically 512 KB to 8 MB), is scheduled by the kernel, and a context switch costs on the order of microseconds, while resuming a stackless coroutine is roughly an indirect call. Coroutines don't schedule themselves: something must call `resume()`, which is why async coroutine code needs an executor (:mod[async-models]).

> **Coming from Go?** Goroutines are stackful: each has a small growable stack and the runtime can park it at any blocking call. A C++ coroutine suspends only where its own body says `co_await` or `co_yield`.

The machinery, defined by the return type's `promise_type`:

- `get_return_object()` creates what the caller receives (a generator, a task).
- `initial_suspend()` and `final_suspend()` decide whether to suspend at start and end. `final_suspend()` must be `noexcept`.
- `yield_value(v)`, `return_value(v)` or `return_void()`, and `unhandled_exception()`.
- An *awaitable* has `await_ready()` (skip suspension?), `await_suspend(handle)` (what to do on suspension: schedule the handle somewhere, or return another handle for symmetric transfer), and `await_resume()` (the result of `co_await`).

A `std::coroutine_handle<Promise>` is a non-owning pointer to a frame: `resume()` continues the coroutine until its next suspension, `done()` says whether it's suspended at its final suspend point, `promise()` reaches the promise, and `destroy()` frees the frame. If `final_suspend()` doesn't suspend, the frame destroys itself when the body finishes; if it does suspend, the frame lives until someone calls `destroy()`, so the owning object (a generator, a task) must do that in its destructor. Resuming a coroutine suspended at its final point is UB. *Symmetric transfer*: when `await_suspend` returns a handle, the current coroutine suspends and that handle is resumed as a tail call, so a chain of coroutines resuming each other doesn't grow the stack.

The standard library provides only `std::generator` (C++23). Async task types come from libraries or C++26's `std::execution` integration.

`std::generator<T>` is lazy: its `initial_suspend` suspends, so nothing in the body runs until `begin()`, which resumes it up to the first `co_yield`. Each `++it` resumes it up to the next `co_yield`. It is a move-only input range with no size, which matters when you pipe it into views: `views::take(n)` over a range that isn't sized wraps the iterator in a `std::counted_iterator`, whose `++` advances the underlying iterator and decrements the count, and the loop stops when the count reaches zero.

The biggest pitfall is lifetime. On entry, the coroutine copies its parameters into the frame: by-value parameters are moved in, but a reference parameter (including `const T&`, `std::string_view` and other views) copies only the reference. The call returns to the caller at the first suspension, and temporaries the caller created for the arguments die at the end of the caller's full-expression. Anything the body uses after a suspension must therefore be owned by the frame: take coroutine parameters by value. Captured references in a coroutine lambda have the same problem.

*Further reading:* [Coroutines (cppreference)](https://en.cppreference.com/w/cpp/language/coroutines), [`std::generator` (cppreference)](https://en.cppreference.com/w/cpp/coroutine/generator)

### Three-way comparison

`a <=> b` returns `std::strong_ordering` (equal values are interchangeable: integers), `std::weak_ordering` (equivalent values may differ: case-insensitive strings), or `std::partial_ordering` (some values are unordered: floating point with NaN). Comparing anything with NaN gives `partial_ordering::unordered`, and every relational operator (`<`, `<=`, `>`, `>=`) and `==` is false for an unordered pair; only `!=` is true.

Defaulting `operator<=>` compares the bases, then the members, in declaration order, lexicographically, and stops at the first that isn't equal. A defaulted `<=>` declared with return type `auto` is defined as deleted if some member has no usable `<=>` (\[class.spaceship\]), and then every relational comparison using it fails to compile.

Equality is separate from ordering. A *defaulted* `<=>` also implicitly declares a defaulted `operator==` (memberwise `==`); a user-written `<=>` doesn't, so a class with a custom `<=>` must declare `==` itself (often `bool operator==(const T&) const = default;`). `==` and `!=` never use `<=>`, because equality is often cheaper than ordering (compare sizes first).

The compiler *rewrites* expressions to use these two operators (\[over.match.oper\]): `a < b` (and `<=`, `>`, `>=`) can become `(a <=> b) < 0`, or with reversed operands `0 < (b <=> a)`; `a != b` becomes `!(a == b)`; and `a == b` can be tried as `b == a`. So one member function handles `int < Price` too, provided int converts implicitly to Price (through a non-explicit converting constructor). The reversed candidate is what allows the int on the left; verified on GCC 14 and Clang 18. A type with `<=>` and `==` supports all six operators, which is what `std::totally_ordered` asks for, and so what `std::ranges::sort` needs by default.

*Further reading:* [Overloading the comparison operators](https://www.learncpp.com/cpp-tutorial/overloading-the-comparison-operators/), [Relational operators and floating point comparisons](https://www.learncpp.com/cpp-tutorial/relational-operators-and-floating-point-comparisons/)

### Designated initializers

C++20 lets you name the members of an aggregate: `P p{.x = 1, .z = 3};`. Designators must appear in the members' declaration order, and you can't mix designated and positional initializers or use nested or array designators (all of which C allows). A member that isn't named is initialized from its default member initializer if it has one, and otherwise from an empty initializer list, which value-initializes it (zero for scalars) (\[dcl.init.aggr\]).

*Further reading:* [Struct aggregate initialization](https://www.learncpp.com/cpp-tutorial/struct-aggregate-initialization/), [Default member initialization](https://www.learncpp.com/cpp-tutorial/default-member-initialization/)

### Smaller C++20/23 features

- **Deducing `this`** (C++23): an explicit object parameter `void f(this Self&& self)` deduces the object's type and value category. `this auto&& self` is a forwarding reference, so it deduces `S&` for a non-const lvalue, `const S&` for a const lvalue and `S&&` for an rvalue. It removes `const`/non-`const` duplication (one `template <class Self> auto&& at(this Self&& self, size_t i)` returning `std::forward_like<Self>(self.data_[i])` serves every qualification), enables recursive lambdas (the lambda can name itself through `self`), and replaces most CRTP.
- **`[[likely]]`, `[[unlikely]]`** hint branch layout and have no effect on what the program means; **`[[assume(expr)]]`** (C++23) tells the optimizer `expr` is true, without evaluating it; if it's false, behavior is undefined, and the optimizer may already have deleted checks that relied on it. **`std::unreachable()`** marks impossible paths, also UB if reached.
- An enumeration with a fixed underlying type (every `enum class`, or `enum E : char`) can hold any value of that type, not only its enumerators, so `static_cast<Side>('X')` is a valid `Side` that matches no `case`. A `switch` that lists every enumerator doesn't prove the default path is unreachable for values that came from outside the program.
- **`auto(x)`** makes a decayed prvalue copy; **static `operator()`** makes stateless function objects cheaper to call.
- **`std::stacktrace`** captures the call stack at runtime; **`std::to_underlying`** converts enums.

```cpp kind=fragment
auto fib = [](this auto const& self, int n) -> int {
    return n < 2 ? n : self(n - 1) + self(n - 2);
};
std::cout << fib(10);   // 55
```

*Further reading:* [Introduction to lambdas (anonymous functions)](https://www.learncpp.com/cpp-tutorial/introduction-to-lambdas-anonymous-functions/), [Scoped enumerations (enum classes)](https://www.learncpp.com/cpp-tutorial/scoped-enumerations-enum-classes/)

### C++26 highlights for trading

- **Static reflection (P2996):** `^^T` produces a `std::meta::info` describing `T`; functions like `std::meta::nonstatic_data_members_of` query it; splicers `[: r :]` turn it back into code; expansion statements (`template for`) loop over members at compile time. Uses: automatic serialization of message structs, enum-to-string, generating decoders, all without macros or code generators.
- **Contracts (P2900):** `pre`, `post` and `contract_assert`, checked according to a build-selected semantic (:mod[error-handling]).
- **`std::execution` (P2300):** senders and receivers for structured asynchronous code (:mod[async-models]).
- **Hazard pointers and RCU:** standard safe memory reclamation for lock-free structures (:mod[lock-free-programming]).
- **`std::simd`:** portable data-parallel types (:mod[hardware]).
- **Smaller:** `std::inplace_vector`, `std::function_ref`, pack indexing `Ts...[0]`, `_` as a placeholder you can declare repeatedly, `#embed` for binary files, `= delete("reason")`, saturation arithmetic (`std::add_sat`), erroneous behavior for uninitialized reads, and a hardened standard library mode with bounds-checked `operator[]`.

### Reflection in practice

A reflection is a value of type `std::meta::info`, so ordinary `consteval` functions inspect it: `nonstatic_data_members_of(^^T, ctx)` and `enumerators_of(^^E)` return a `std::vector<std::meta::info>`, and `identifier_of(r)` returns a member's or enumerator's name as a `std::string_view`. The `ctx` argument is a `std::meta::access_context` that decides whether private members are visible (`access_context::current()` respects access, `unchecked()` doesn't). A compile-time `std::vector` can't survive into run time, so `std::define_static_array(v)` turns it into a static array that `template for` can loop over. Inside the loop each element is a constant, so it can be spliced: `obj.[:m:]` names the member `m` reflects, and `[:e:]` names the enumerator `e` reflects.

```cpp run=none
template <class E>
constexpr std::string_view enum_to_string(E value) {
    template for (constexpr auto e : std::define_static_array(std::meta::enumerators_of(^^E)))
        if (value == [:e:]) return std::meta::identifier_of(e);
    return "<unknown>";
}
```

Implementations (the Clang fork used on Compiler Explorer, GCC trunk) still differ in spelling and flags, so check the one you use.

### Contracts and erroneous behavior

A contract assertion is evaluated with one of four semantics chosen by the build, not by the code: *ignore* (the predicate isn't evaluated), *observe* (evaluated; a violation calls the violation handler and execution continues), *enforce* (a violation calls the handler, then terminates) or *quick-enforce* (terminates immediately, no handler). Because of that, and because an implementation may evaluate a predicate more than once (\[basic.contract.eval\]), a predicate's side effects can happen zero, one or several times: predicates must not have side effects the program depends on. Parameters, locals and `*this` named in a predicate are treated as `const`, which blocks the obvious mistakes but not writes to globals or through pointers.

*Erroneous behavior* (C++26) is a new category between defined and undefined behavior: the program is wrong, the implementation is encouraged to diagnose it, but the result is still well-defined. Reading an uninitialized automatic variable is the first case: instead of UB, it yields an implementation-chosen value (:mod[types-and-initialization]). `[[indeterminate]]` on a variable opts back into the old UB for code that measurably needs it.

*Further reading:* [Assert and static_assert](https://www.learncpp.com/cpp-tutorial/assert-and-static_assert/), [Uninitialized variables and undefined behavior](https://www.learncpp.com/cpp-tutorial/uninitialized-variables-and-undefined-behavior/)
