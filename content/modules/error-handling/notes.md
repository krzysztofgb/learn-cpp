### Exceptions and unwinding

`throw` copies or moves the exception object into special storage, then the runtime unwinds the stack, destroying automatic objects in each frame until a matching `catch` is found. If none is found, `std::terminate` runs (whether the stack is unwound first is implementation-defined).

- A handler matches if its type is the exception's type or an unambiguous public base of it (caught by value or by reference); `catch (...)` matches anything. Handlers are tried in order and the first match wins, even if a later one is more specific, so put derived types before bases. A derived-type handler after its base's can never run; compilers warn.
- Catch by `const&`. Catching by value copies the exception and slices a derived one to the handler's type, so virtual calls like `what()` reach the base version.
- `throw;` rethrows the current exception object unchanged. `throw e;` throws a new copy of the static type of `e`, slicing it.
- Unwinding destroys *objects*. A raw pointer's destruction does nothing, so memory or handles owned through raw pointers leak when an exception passes through. Hold every resource in an RAII object (`unique_ptr`, a container, a lock guard) and unwinding releases it (:sec[object-lifetime/raii]).
- Destructors are implicitly `noexcept`, so an exception leaving one calls `std::terminate`. Even a `noexcept(false)` destructor terminates the program if it throws while the stack is being unwound for another exception, because two exceptions can't propagate at once (:sec[object-lifetime/destructors-and-exceptions]).
- `std::exception_ptr` (`std::current_exception`, `std::rethrow_exception`) moves exceptions across threads, which is how `std::future` delivers them.

*Further reading:* [Basic exception handling](https://www.learncpp.com/cpp-tutorial/basic-exception-handling/), [Exceptions, functions, and stack unwinding](https://www.learncpp.com/cpp-tutorial/exceptions-functions-and-stack-unwinding/), [Uncaught exceptions and catch-all handlers](https://www.learncpp.com/cpp-tutorial/uncaught-exceptions-catch-all-handlers/), [Exceptions, classes, and inheritance](https://www.learncpp.com/cpp-tutorial/exceptions-classes-and-inheritance/), [Rethrowing exceptions](https://www.learncpp.com/cpp-tutorial/rethrowing-exceptions/)

### Exception safety guarantees

| Guarantee | Promise if an exception escapes | Example |
| --- | --- | --- |
| No-throw | Never throws | Destructors, `swap`, move operations of most types |
| Strong | State is unchanged (commit-or-rollback) | `vector::push_back` when the element's move is `noexcept` or it's copyable |
| Basic | Invariants hold and nothing leaks, but state may have changed | Most operations |
| None | Anything | Code with raw `new` and no cleanup |

The usual way to get the strong guarantee: do all the work that can throw on the side, then commit with non-throwing operations (copy-and-swap is one instance). Two consequences:

- When one operation updates several data structures that must stay consistent, every step that can throw (an insertion that allocates, say) has to happen before the state is committed, or be undone if a later step throws. Reserving capacity up front turns a later insertion into one that can't throw.
- A function that removes an element and also returns it by value can't give the strong guarantee if copying the return value can throw: by then the element is already gone. That's why such interfaces are split into an observer that returns a reference and a mutator that returns nothing.

*Further reading:* [Exception dangers and downsides](https://www.learncpp.com/cpp-tutorial/exception-dangers-and-downsides/)

### `noexcept`

`noexcept` on a function is a promise. If an exception escapes it, `std::terminate` is called, with no guarantee the stack is unwound; the search for a handler stops at the `noexcept` function, so a `catch` in its caller never sees the exception.

The `noexcept(expr)` operator asks at compile time whether an expression is declared non-throwing. It doesn't evaluate `expr`; it yields `false` if the expression calls a potentially-throwing function or contains a `throw`. A function is potentially throwing unless it has a non-throwing exception specification: a plain declaration `void f();` is, while destructors and most implicitly declared special members are implicitly `noexcept`. Built-in operations on scalars never throw.

Why it matters for performance: `std::vector` reallocation must give the strong guarantee, so it moves elements only if the move constructor is `noexcept` (or the type isn't copyable), via `std::move_if_noexcept`. A move constructor without `noexcept` makes every reallocation copy. Defaulted moves are `noexcept` automatically when all members' moves are.

*Further reading:* [Exception specifications and noexcept](https://www.learncpp.com/cpp-tutorial/exception-specifications-and-noexcept/), [std::move\_if\_noexcept](https://www.learncpp.com/cpp-tutorial/stdmove_if_noexcept/)

### What exceptions cost

The mainstream implementation is table-based ("zero-cost") unwinding: no runtime cost on the non-throwing path, but larger binaries and some lost optimizations across calls that might throw. Throwing is expensive: allocation, a search through unwind tables, and destructor calls, on the order of microseconds. Error codes and `std::expected` are the other way round: a check and a branch on every call, even when nothing fails, but failure costs no more than success.

That's why many low-latency codebases build with exceptions disabled (`-fno-exceptions` on GCC and Clang; on MSVC, building without `/EHsc` and with `_HAS_EXCEPTIONS=0` for its standard library): predictable latency and smaller hot code. The catch: `throw`, `try` and `catch` in your own code no longer compile (GCC and Clang reject them), and standard library operations that would throw (like allocation failure or `vector::at` out of range) abort instead.

A reasonable policy used at many firms: exceptions for startup and configuration errors, never on the hot path; `std::expected` or error codes for runtime failures like order rejections.

### Alternatives

- **`std::optional<T>`:** "maybe a value", no reason given.
- **`std::expected<T, E>` (C++23):** a value or an error, in one object. Return a value to succeed and `std::unexpected(err)` to fail; `if (r)` tests which, `r.error()` reads the error. `.value()` throws `std::bad_expected_access` on error; `*r` is unchecked (UB on error). Monadic functions chain steps without nested `if`s: `transform(f)` applies `f` to a value and wraps the result, `and_then(f)` calls an `f` that itself returns an `expected`, `or_else` and `transform_error` act on the error, and in each case the other alternative passes through untouched.
- **`std::error_code`:** an integer plus a category, used by `<system_error>`, `<filesystem>` and networking libraries.
- **Contracts (C++26):** `pre(...)` and `post(...)` on declarations and `contract_assert(...)` in bodies, with a build-selected evaluation semantic: ignore, observe, enforce or quick-enforce. They express bugs (violated preconditions), not recoverable errors.

> **Coming from Go?** `std::expected<T, E>` plays the role of Go's `(T, error)` pair, but it's one object that holds either the value or the error, never both, and the monadic functions replace the `if err != nil { return err }` after each call.

*Further reading:* [std::optional](https://www.learncpp.com/cpp-tutorial/stdoptional/), [Detecting and handling errors](https://www.learncpp.com/cpp-tutorial/detecting-and-handling-errors/), [Assert and static\_assert](https://www.learncpp.com/cpp-tutorial/assert-and-static_assert/), [std::expected](https://en.cppreference.com/w/cpp/utility/expected)
