### Exceptions and unwinding

`throw` copies or moves the exception object into special storage, then the runtime unwinds the stack, destroying automatic objects in each frame until a matching `catch` is found. If none is found, `std::terminate` runs (whether the stack is unwound first is implementation-defined).

- Catch by `const&`. Catching by value slices derived exceptions and copies.
- Handlers are tried in order, so put derived types before bases.
- `throw;` rethrows the current exception object unchanged. `throw e;` throws a new copy of the static type of `e`, slicing it.
- `std::exception_ptr` (`std::current_exception`, `std::rethrow_exception`) moves exceptions across threads, which is how `std::future` delivers them.

### Exception safety guarantees

| Guarantee | Promise if an exception escapes | Example |
| --- | --- | --- |
| No-throw | Never throws | Destructors, `swap`, move operations of most types |
| Strong | State is unchanged (commit-or-rollback) | `vector::push_back` when the element's move is `noexcept` or it's copyable |
| Basic | Invariants hold and nothing leaks, but state may have changed | Most operations |
| None | Anything | Code with raw `new` and no cleanup |

The usual way to get the strong guarantee: do all the work that can throw on the side, then commit with non-throwing operations (copy-and-swap is one instance).

### `noexcept`

`noexcept` on a function is a promise. If an exception escapes it, `std::terminate` is called, with no guarantee the stack is unwound. The `noexcept(expr)` operator asks at compile time whether an expression is declared non-throwing.

Why it matters for performance: `std::vector` reallocation must give the strong guarantee, so it moves elements only if the move constructor is `noexcept` (or the type isn't copyable), via `std::move_if_noexcept`. A move constructor without `noexcept` makes every reallocation copy. Defaulted moves are `noexcept` automatically when all members' moves are.

### What exceptions cost

The mainstream implementation is table-based ("zero-cost") unwinding: no runtime cost on the non-throwing path, but larger binaries and some lost optimizations across calls that might throw. Throwing is expensive: allocation, a search through unwind tables, and destructor calls, on the order of microseconds. That's why many low-latency codebases compile with `-fno-exceptions`: predictable latency and smaller hot code. The catch: standard library operations that would throw (like allocation failure or `vector::at` out of range) abort instead.

A reasonable policy used at many firms: exceptions for startup and configuration errors, never on the hot path; `std::expected` or error codes for runtime failures like order rejections.

### Alternatives

- **`std::optional<T>`:** "maybe a value", no reason given.
- **`std::expected<T, E>` (C++23):** a value or an error, like Go's `(T, error)` but in one object. `.value()` throws `std::bad_expected_access` on error; `*r` is unchecked (UB on error). Monadic `and_then`, `transform`, `or_else` and `transform_error` chain operations without nested `if`s.
- **`std::error_code`:** an integer plus a category, used by `<system_error>`, `<filesystem>` and networking libraries.
- **Contracts (C++26):** `pre(...)` and `post(...)` on declarations and `contract_assert(...)` in bodies, with a build-selected evaluation semantic: ignore, observe, enforce or quick-enforce. They express bugs (violated preconditions), not recoverable errors.
