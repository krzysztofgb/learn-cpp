# Module 7: Error handling

C++ offers exceptions, error codes, `std::optional` and `std::expected`, and trading firms disagree about which to use. Interviewers want you to know the exception safety guarantees, how `noexcept` changes container behavior, and the latency trade-offs.

## Notes

### 7.1 Exceptions and unwinding

`throw` copies or moves the exception object into special storage, then the runtime unwinds the stack, destroying automatic objects in each frame until a matching `catch` is found. If none is found, `std::terminate` runs (whether the stack is unwound first is implementation-defined).

- Catch by `const&`. Catching by value slices derived exceptions and copies.
- Handlers are tried in order, so put derived types before bases.
- `throw;` rethrows the current exception object unchanged. `throw e;` throws a new copy of the static type of `e`, slicing it.
- `std::exception_ptr` (`std::current_exception`, `std::rethrow_exception`) moves exceptions across threads, which is how `std::future` delivers them.

### 7.2 Exception safety guarantees

| Guarantee | Promise if an exception escapes | Example |
| --- | --- | --- |
| No-throw | Never throws | Destructors, `swap`, move operations of most types |
| Strong | State is unchanged (commit-or-rollback) | `vector::push_back` when the element's move is `noexcept` or it's copyable |
| Basic | Invariants hold and nothing leaks, but state may have changed | Most operations |
| None | Anything | Code with raw `new` and no cleanup |

The usual way to get the strong guarantee: do all the work that can throw on the side, then commit with non-throwing operations (copy-and-swap is one instance).

### 7.3 `noexcept`

`noexcept` on a function is a promise. If an exception escapes it, `std::terminate` is called, with no guarantee the stack is unwound. The `noexcept(expr)` operator asks at compile time whether an expression is declared non-throwing.

Why it matters for performance: `std::vector` reallocation must give the strong guarantee, so it moves elements only if the move constructor is `noexcept` (or the type isn't copyable), via `std::move_if_noexcept`. A move constructor without `noexcept` makes every reallocation copy. Defaulted moves are `noexcept` automatically when all members' moves are.

### 7.4 What exceptions cost

The mainstream implementation is table-based ("zero-cost") unwinding: no runtime cost on the non-throwing path, but larger binaries and some lost optimizations across calls that might throw. Throwing is expensive: allocation, a search through unwind tables, and destructor calls, on the order of microseconds. That's why many low-latency codebases compile with `-fno-exceptions`: predictable latency and smaller hot code. The catch: standard library operations that would throw (like allocation failure or `vector::at` out of range) abort instead.

A reasonable policy used at many firms: exceptions for startup and configuration errors, never on the hot path; `std::expected` or error codes for runtime failures like order rejections.

### 7.5 Alternatives

- **`std::optional<T>`:** "maybe a value", no reason given.
- **`std::expected<T, E>` (C++23):** a value or an error, like Go's `(T, error)` but in one object. `.value()` throws `std::bad_expected_access` on error; `*r` is unchecked (UB on error). Monadic `and_then`, `transform`, `or_else` and `transform_error` chain operations without nested `if`s.
- **`std::error_code`:** an integer plus a category, used by `<system_error>`, `<filesystem>` and networking libraries.
- **Contracts (C++26):** `pre(...)` and `post(...)` on declarations and `contract_assert(...)` in bodies, with a build-selected evaluation semantic: ignore, observe, enforce or quick-enforce. They express bugs (violated preconditions), not recoverable errors.

## Predict the output

**P1**

```cpp kind=fragment run=local
struct Base : std::exception {
    const char* what() const noexcept override { return "base"; }
};
struct Der : Base {
    const char* what() const noexcept override { return "der"; }
};
try { throw Der{}; } catch (Base e) { cout << e.what(); }
```

**P2**

```cpp kind=fragment run=none
try {
    try { throw Der{}; }
    catch (Base& e) { throw e; }
} catch (Der&)  { cout << "der"; }
  catch (Base&) { cout << "base"; }
```

(What if `throw e;` becomes `throw;`?)

**P3**

```cpp kind=fragment run=local
void f();
void g() noexcept;
cout << noexcept(f()) << noexcept(g()) << noexcept(1 + 1);
```

**P4**

```cpp kind=fragment run=local
struct S {
    S() = default;
    S(const S&) { cout << 'C'; }
    S(S&&)      { cout << 'M'; }
};
std::vector<S> v;
v.reserve(1);
v.emplace_back();
v.emplace_back();
```

(What if the move constructor is `noexcept`?)

**P5**

```cpp kind=fragment run=local
void f() noexcept { throw 1; }
try { f(); } catch (...) { cout << "caught"; }
cout << "after";
```

**P6**

```cpp kind=fragment run=local
std::expected<int, std::string> parse(std::string_view s) {
    if (s.empty()) return std::unexpected("empty");
    return static_cast<int>(s.size());
}
auto r = parse("abc").transform([](int n) { return n * 10; });
auto e = parse("").transform([](int n) { return n * 10; });
cout << *r << ' ' << e.error();
```

## Spot the bug or UB

**U1**

```cpp kind=fragment run=local
struct Flusher {
    ~Flusher() noexcept(false) { throw std::runtime_error("flush"); }
};
void process() {
    Flusher f;
    throw std::logic_error("bad order");
}
```

**U2**

```cpp kind=fragment run=none
void Book::add(Order* o) {
    orders_.push_back(o);          // std::vector<Order*>
    by_id_.emplace(o->id, o);      // std::unordered_map<Id, Order*>
}
```

**U3**

```cpp kind=fragment run=none
void init() {
    Feed* feed = new Feed;
    Gateway* gw = new Gateway;   // may throw
    run(feed, gw);
    delete gw; delete feed;
}
```

**U4**

```cpp kind=fragment run=none
std::expected<Order, Reject> r = validate(msg);
send(*r);
```

**U5**

```cpp kind=fragment run=none
try { risky(); }
catch (const std::exception& e) { log(e.what()); }
catch (const std::runtime_error& e) { recover(); }
```

## Exercises

**E1 ★ Guarantees in code.** Write four versions of `void Account::transfer(Account& to, int64_t amt)`, one per guarantee level, where an intermediate step may throw. Write a test that injects a throw and checks the post-state for each.

**E2 ★★ Strong-guarantee stack.** Implement `Stack<T>` over `std::vector<T>` with `push` and `pop`. Explain why `std::stack` splits `top()` and `pop()` instead of having `T pop()` (hint: what happens if copying the returned value throws?).

**E3 ★★ From exceptions to `expected`.** Rewrite a three-stage parser (tokenize, parse fields, validate) from exceptions to `std::expected` using `and_then`. Compare the call sites with Go's `if err != nil` style.

**E4 ★★ Measure it.** Benchmark a function that fails at rates of 0%, 0.1%, 1% and 50%, reporting failure via exception, `std::expected` and an error code. Plot cost per call and explain where each approach wins.

**E5 ★★★ Life without exceptions.** Build a small program with `-fno-exceptions`. Observe what happens with `std::vector::at` out of range and with `throw` in your own code. Then design an allocation-failure-aware `FixedVector<T, N>` API returning `bool` or `std::expected`.

## Interview questions

1. Name and define the exception safety guarantees.
2. Why does it matter whether a move constructor is `noexcept`?
3. What do exceptions cost on the happy path and when thrown?
4. Why do many trading firms disable exceptions, and what do they use instead?
5. Error codes vs exceptions vs `std::expected`: when would you use each?
6. What happens if an exception escapes a `noexcept` function?
7. Can a destructor throw? What happens if it does?
8. Why catch by reference? What's the difference between `throw;` and `throw e;`?
9. How does `std::future` deliver an exception from another thread?
10. What problem do C++26 contracts solve?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `base` | Catching by value slices `Der` to `Base`. |
| P2 | `base`; with `throw;`: `der` | `throw e;` throws a copy of static type `Base`. `throw;` rethrows the original `Der`. |
| P3 | `011` | `f` isn't declared `noexcept`; built-in arithmetic can't throw. |
| P4 | `C`; with `noexcept`: `M` | Reallocation copies the existing element unless the move is `noexcept`. |
| P5 | Terminates; nothing printed | The exception can't escape `f`, so `std::terminate` runs before any handler. |
| P6 | `30 empty` | `transform` applies only to a value; the error passes through untouched. |

### Spot the bug or UB

- **U1:** While `logic_error` unwinds the stack, `~Flusher` throws a second exception, so `std::terminate` is called. Never throw from destructors.
- **U2:** Only the basic guarantee at best: if `emplace` throws (allocation), `orders_` contains a pointer `by_id_` doesn't, breaking the invariant. Insert into the map first, and roll it back if `push_back` throws, or reserve capacity in advance.
- **U3:** If `new Gateway` or `run` throws, everything allocated leaks. Use `std::make_unique` for both.
- **U4:** UB if `validate` returned an error: `operator*` doesn't check. Test `if (r)` first, or use `r.value()` to get an exception.
- **U5:** The second handler is unreachable because `runtime_error` derives from `exception`. Order handlers from most to least derived; compilers warn.

### Exercise hints

- **E2:** If `T pop()` removed the element and then copying the return value threw, the element would be lost. Splitting lets `top()` copy first and `pop()` remove only after success.
- **E4:** At 0% failure, exceptions are typically the fastest because the happy path has no checks. As failure rates rise, exceptions become orders of magnitude slower.

### Interview questions

1. No-throw, strong (no change on failure), basic (valid but unspecified state, no leaks), none. See table 7.2.
2. `vector` and other containers use moves during reallocation only if they can't throw, to keep the strong guarantee. Otherwise they copy, which can be far slower.
3. Zero runtime overhead when nothing throws with table-based unwinding, but larger binaries. A throw costs microseconds: allocation, table lookup, unwinding.
4. Thrown exceptions have unpredictable latency and bloat hot code. Firms use error codes, `std::expected`, or status enums on the hot path, and sometimes exceptions only at startup.
5. Exceptions for rare, unrecoverable-at-this-level errors (startup, configuration); `expected` for expected failures the caller must handle; error codes at C boundaries or with OS APIs.
6. `std::terminate` is called; the stack may or may not be unwound.
7. It can if declared `noexcept(false)`, but it's almost always a mistake: during unwinding it terminates the program, and by default destructors are `noexcept`, so throwing terminates immediately.
8. By reference to avoid slicing and copies. `throw;` rethrows the original object; `throw e;` copies `e` as its static type.
9. The worker catches the exception and stores a `std::exception_ptr` in the shared state; `future::get()` rethrows it in the calling thread.
10. They state preconditions, postconditions and assertions in the code itself, checkable according to a build-wide policy, so bugs in how a function is called are caught without ad hoc `assert` macros.
