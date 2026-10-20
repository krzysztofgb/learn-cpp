# Module 5: Object lifetime

Go's garbage collector keeps anything reachable alive. In C++, every object has a precise start and end of life, and most memory-safety bugs are uses of an object outside that window. RAII, the core C++ idiom, ties resource ownership to it.

## Notes

### 5.1 Storage duration and lifetime

| Storage | Created | Destroyed |
| --- | --- | --- |
| Automatic | When the declaration executes | At the end of its scope, in reverse order |
| Static | Namespace scope: before `main` (mostly). Function-local: first time control passes the declaration | After `main` returns, in reverse order of construction |
| Thread | Per thread, at first use or thread start | At thread exit |
| Dynamic | `new` | `delete` |

An object's lifetime begins when its initialization completes and ends when its destructor starts. Accessing it outside that window through a pointer or reference is UB, even if the memory is still there.

Destruction order mirrors construction: members in reverse declaration order, then bases in reverse order. If a constructor throws, the object's destructor does not run, but every fully constructed member and base is destroyed.

### 5.2 RAII

Acquire a resource in a constructor and release it in the destructor: memory (`unique_ptr`), locks (`lock_guard`), file descriptors, sockets, timers. Because destructors run during stack unwinding, cleanup happens on every exit path, including exceptions. It's Go's `defer` generalized and bound to a value you can move around.

### 5.3 Temporaries and lifetime extension

A temporary is destroyed at the end of the *full-expression* that created it (roughly, at the semicolon). One exception: binding a prvalue directly to a local `const T&` or `T&&` extends the temporary's life to the reference's scope. Extension does not happen when:

- The reference comes from a function's return value: `const auto& m = std::max(a, std::string("z"));` dangles if the temporary is the larger one.
- The temporary is bound in a `return` statement or to a reference parameter.
- You call a member function that returns a reference into the temporary: `auto& n = make().name();`.
- A `std::string_view`, `std::span` or other view is constructed from it; views aren't references, so nothing is extended.

Range-`for` over an expression like `for (int x : make().items())` was a classic dangling bug: only the final `items()` result is extended, not `make()`'s temporary. C++23 (P2718) extends all temporaries in the range initializer, fixing it. Still avoid the pattern when supporting older standards.

### 5.4 Static initialization order

Within one TU, namespace-scope statics initialize in declaration order. Across TUs, the order is unspecified. A global constructor in one file that reads a global from another may see it unconstructed: the *static initialization order fiasco*.

Fixes: make the dependency a function-local static ("construct on first use"), which C++11 guarantees is initialized exactly once even with concurrent callers ("magic statics"); make it `constexpr` or `constinit` so it's initialized at compile time; or avoid non-trivial globals entirely. The mirror problem exists at shutdown: a static destructor may use another static that's already destroyed.

### 5.5 Common dangling patterns

- Returning a reference or pointer to a local.
- A lambda capturing locals by reference that outlives the scope: stored callbacks, detached threads, `std::function` returned from a function.
- Holding a pointer, reference or iterator into a container across an operation that reallocates (Module 11).
- `const char* p = some_string_temporary.c_str();`.
- A view (`string_view`, `span`) of a temporary.

### 5.6 Destructors and exceptions

Destructors are implicitly `noexcept`. If one throws, `std::terminate` is called. Even with `noexcept(false)`, a destructor that throws while another exception is unwinding the stack terminates the program. Report failures in destructors some other way (log, set a flag) and offer an explicit `close()` that can throw.

## Predict the output

All snippets use this helper:

```cpp kind=fragment run=local
struct M {
    const char* n;
    M(const char* n) : n(n) { cout << '+' << n; }
    ~M() { cout << '-' << n; }
};
```

**P1**

```cpp kind=fragment run=none
struct B { M m{"b"}; };
struct D : B { M x{"x"}; M y{"y"}; };
{ D d; }
```

**P2**

```cpp kind=fragment run=none
M make() { return M{"t"}; }
{
    const M& r = make();
    cout << '|';
}
cout << '.';
```

**P3**

```cpp kind=fragment run=none
{
    M("a");
    M b("b");
    cout << '|';
}
```

**P4**

```cpp kind=program run=none
M& get() { static M m{"s"}; return m; }
int main() {
    cout << 'a'; get(); get(); cout << 'b';
}
```

**P5**

```cpp kind=fragment run=none
struct S {
    M a{"a"};
    M b{"b"};
    S() { throw 1; }
    ~S() { cout << "~S"; }
};
try { S s; } catch (int) { cout << " caught"; }
```

**P6** (C++20 and C++23)

```cpp kind=fragment run=local
struct Holder {
    std::vector<int> v{1, 2, 3};
    const std::vector<int>& get() const { return v; }
};
Holder make_holder() { return {}; }
for (int x : make_holder().get()) cout << x;
```

## Spot the UB

**U1**

```cpp kind=fragment run=local
std::string a = "abc";
const std::string& m = std::max(a, std::string("zzz"));
std::cout << m;
```

**U2**

```cpp kind=fragment run=local
std::function<int()> make_counter() {
    int count = 0;
    return [&] { return ++count; };
}
```

**U3**

```cpp kind=fragment run=none
// prefix.cpp
std::string g_prefix = "MD:";
// topic.cpp
extern std::string g_prefix;
std::string g_topic = g_prefix + "AAPL";
```

**U4**

```cpp kind=fragment run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
void start(const Config& cfg) {
    std::thread t([&] { run(cfg); });
    t.detach();
}
// called as: start(Config{...});
```

**U5**

```cpp kind=fragment run=local
struct Conn {
    ~Conn() { if (!flush()) throw std::runtime_error("flush failed"); }
    bool flush();
};
```

**U6**

```cpp kind=fragment run=local
const char* p = std::string("abc").c_str();
std::puts(p);
```

## Exercises

**E1 ★ Lifetime tracer.** Using `M`, predict and verify the output for: returning by value, passing by value, `std::vector<M>` growth, `std::optional<M>` reset, a temporary bound to `const M&`, and a ternary expression mixing a named object and a temporary.

**E2 ★★ `defer`.** Implement a Go-style `ScopeGuard` that runs a callable on scope exit, with `dismiss()` and a `noexcept` destructor. Add a `DEFER(...)` macro creating a uniquely named guard. Use it to close a file descriptor on every path of a function with three early returns.

**E3 ★★ The fiasco, live.** Reproduce U3 across two TUs. Change the link order to change the outcome. Then fix it three ways: a function-local static, `constinit` with a `constexpr` constructor type, and `inline constexpr std::string_view`.

**E4 ★★ `UniqueFd`.** Write a move-only RAII wrapper for a POSIX file descriptor with `release`, `reset` and `get`. Moved-from objects hold -1. Prove with a test that no descriptor leaks when a function throws midway.

**E5 ★★★ Let the compiler find dangling.** Annotate `name()` from Module 4 U3 and a `max`-like function with `[[clang::lifetimebound]]`. Show that Clang now warns on the dangling uses in U1 and Module 4 U3, and check what `-Wdangling` and `-Wdangling-gsl` catch without annotations.

## Interview questions

1. What are the storage durations in C++?
2. What is RAII? Compare it to Go's `defer` or Java's `finally`.
3. What is temporary lifetime extension, and when doesn't it apply?
4. What is the static initialization order fiasco, and how do you avoid it?
5. Are function-local statics thread-safe to initialize?
6. What happens when a constructor throws halfway through?
7. Why shouldn't destructors throw?
8. In what order are members and bases destroyed?
9. Give three ways to create a dangling reference.

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `+b+x+y-y-x-b` | Base first, members in declaration order; destruction reversed. |
| P2 | `+t\|-t.` | Binding to `const M&` extends the temporary to the end of the block. |
| P3 | `+a-a+b\|-b` | `M("a");` creates an unnamed temporary destroyed at the semicolon. The same mistake with `std::lock_guard<std::mutex>(m);` locks nothing useful. |
| P4 | `a+sb-s` | Constructed on first call, destroyed after `main` returns. |
| P5 | `+a+b-b-a caught` | Fully constructed members are destroyed in reverse; `~S` never runs. |
| P6 | C++20: UB. C++23: `123` | Before C++23 the `Holder` temporary dies before the loop body runs. C++23 adopted P2718R0, which extends every temporary in the range initializer. **Compiler support lags:** GCC 15+ and Clang 19+ implement it (check `__cpp_range_based_for >= 202211L`). GCC 14 and Clang 18 still dangle even with `-std=c++23` (verified with ASan), so don't rely on the fix yet. |

### Spot the UB

- **U1:** `std::max` returns a reference to its larger argument, the temporary. The temporary dies at the semicolon, so `m` dangles. Store the result by value.
- **U2:** The lambda captures the local `count` by reference and outlives it. Capture by value with `mutable`: `[count = 0]() mutable { return ++count; }`.
- **U3:** If `topic.cpp`'s initializer runs first, it calls `operator+` on an unconstructed string: UB. It depends on link order.
- **U4:** The temporary `Config` dies when `start`'s caller finishes its full expression, while the detached thread still reads it. Copy it into the lambda: `[cfg] { run(cfg); }`.
- **U5:** Not UB, but the throw calls `std::terminate`, because destructors are `noexcept`. Provide an explicit `close()` that can throw and have the destructor swallow and log failures.
- **U6:** The temporary string dies at the semicolon; `p` dangles. Keep the string alive in a named variable.

### Exercise hints

- **E1:** A ternary with a named lvalue and a temporary produces a prvalue, so it copies the named object.
- **E2:** Make `ScopeGuard` move-only, and in the destructor call the function only if not dismissed. For unique names, paste `__LINE__` or `__COUNTER__` with a two-level macro.
- **E3:** `constinit` requires a constant initializer, so it fails to compile with `std::string` concatenation, which is the point: it turns the hazard into an error.

### Interview questions

1. Automatic, static, thread and dynamic; see table 5.1.
2. Resource ownership tied to object lifetime: acquire in the constructor, release in the destructor, which runs on every exit including exceptions. Unlike `defer`, the cleanup travels with the object when it's moved or stored, and it's scoped to blocks rather than functions.
3. Binding a prvalue directly to a local `const T&` or `T&&` keeps it alive for the reference's scope. It doesn't apply through function return values, member functions returning references, views, return statements, or reference parameters.
4. Unspecified initialization order of globals across TUs means one global's initializer may use another before it's constructed. Use function-local statics, `constexpr`/`constinit`, or avoid dynamic initialization of globals.
5. Yes, since C++11. The compiler emits a guard variable and a lock so exactly one thread initializes and others wait. There is a small check cost on every call.
6. The destructor for that object does not run. Already-constructed bases and members are destroyed in reverse order, then the exception propagates; memory from a `new` expression is freed.
7. They are implicitly `noexcept`, so a throw calls `std::terminate`. Even if marked `noexcept(false)`, throwing during unwinding terminates.
8. Destructor body first, then members in reverse declaration order, then bases in reverse order of declaration.
9. Returning a reference to a local; capturing by reference in a lambda that outlives the scope; keeping a reference into a vector across `push_back`; `string_view` of a temporary string.
