### Storage duration and lifetime

| Storage | Created | Destroyed |
| --- | --- | --- |
| Automatic | When the declaration executes | At the end of its scope, in reverse order |
| Static | Namespace scope: before `main` (mostly). Function-local: first time control passes the declaration | After `main` returns, in reverse order of construction |
| Thread | Per thread, at first use or thread start | At thread exit |
| Dynamic | `new` | `delete` |

An object's lifetime begins when its initialization completes and ends when its destructor starts (\[basic.life\]). Accessing it outside that window through a pointer or reference is UB, even if the memory is still there. A function-local `static` is constructed the first time control passes its declaration and destroyed after `main` returns, along with the namespace-scope statics.

Construction runs bases first (in declaration order), then members in declaration order, then the constructor body. Destruction mirrors it exactly: the destructor body, then members in reverse declaration order, then bases in reverse order. If a constructor throws, the object's destructor does not run, because its lifetime never began, but every fully constructed member and base is destroyed in reverse order before the exception propagates. If the object was being created by a `new` expression, its memory is also freed with the matching `operator delete`.

> **Coming from Go?** Go's garbage collector keeps anything reachable alive, and escape analysis moves a local to the heap if its address escapes. In C++ a local dies at the end of its scope no matter who still points to it.

*Further reading:* [Local variables](https://www.learncpp.com/cpp-tutorial/local-variables/), [Static local variables](https://www.learncpp.com/cpp-tutorial/static-local-variables/), [Scope, duration, and linkage summary](https://www.learncpp.com/cpp-tutorial/scope-duration-and-linkage-summary/), [Dynamic memory allocation with new and delete](https://www.learncpp.com/cpp-tutorial/dynamic-memory-allocation-with-new-and-delete/), [Order of construction of derived classes](https://www.learncpp.com/cpp-tutorial/order-of-construction-of-derived-classes/)

### RAII

Acquire a resource in a constructor and release it in the destructor: memory (`unique_ptr`), locks (`lock_guard`), file descriptors, sockets, timers. Because destructors run during stack unwinding, cleanup happens on every exit path, including exceptions. Compared with an explicit cleanup construct (a `finally` block, or a statement that schedules a call for when the function returns), RAII can't be forgotten at a call site, is scoped to the enclosing block rather than the whole function, and travels with the object when it's moved or stored. A *scope guard* is the general-purpose version: an object holding a callable that it runs in its destructor unless dismissed.

A RAII object has to be named to do anything. `std::lock_guard<std::mutex>{m};` creates a temporary that locks and immediately unlocks at the semicolon. Write `std::lock_guard<std::mutex> lock(m);` (or `std::scoped_lock lock(m);`).

> **Coming from Go?** RAII is `defer` generalized: instead of writing `defer f.Close()` after every open, the file object closes itself in its destructor wherever it goes out of scope, and the obligation moves with the object.

*Further reading:* [Introduction to destructors](https://www.learncpp.com/cpp-tutorial/introduction-to-destructors/), [Exceptions, functions, and stack unwinding](https://www.learncpp.com/cpp-tutorial/exceptions-functions-and-stack-unwinding/)

### Temporaries and lifetime extension

A temporary is destroyed at the end of the *full-expression* that created it (roughly, at the semicolon). One exception: binding a prvalue directly to a local `const T&` or `T&&` extends the temporary's life to the reference's scope. Extension does not happen when:

- The reference comes from a function's return value: `const auto& m = std::max(a, std::string("z"));` dangles if the temporary is the larger one.
- The temporary is bound in a `return` statement or to a reference parameter.
- You call a member function that returns a reference into the temporary: `auto& n = make().name();`.
- A `std::string_view`, `std::span` or other view is constructed from it; views aren't references, so nothing is extended.

A temporary bound to a reference parameter lives until the end of the *caller's* full-expression, which is long enough for the call itself but not for anything that keeps the reference afterwards, such as a detached thread or a stored callback.

A conditional expression `c ? named : make()` whose operands are an lvalue and a prvalue of the same class type is a prvalue, so the lvalue operand is copied into a temporary.

Range-`for` over an expression like `for (int x : make().items())` was a classic dangling bug: only the final `items()` result is extended, not `make()`'s temporary. C++23 (P2718) extends all temporaries in the range initializer, fixing it, but compilers implemented it late (GCC 15, Clang 19). Still avoid the pattern when supporting older standards or compilers.

*Further reading:* [Temporary class objects](https://www.learncpp.com/cpp-tutorial/temporary-class-objects/), [Lvalue references to const](https://www.learncpp.com/cpp-tutorial/lvalue-references-to-const/)

### Static initialization order

Within one TU, namespace-scope statics initialize in declaration order. Across TUs, the order is unspecified. A global constructor in one file that reads a global from another may see it unconstructed: the *static initialization order fiasco*.

Constant initialization (a `constexpr` constructor or a constant expression, and zero-initialization) happens before any dynamic initialization, so it's immune. The fiasco only affects *dynamic* initialization, such as a `std::string` built from another global.

Fixes: make the dependency a function-local static ("construct on first use"), which C++11 guarantees is initialized exactly once even with concurrent callers ("magic statics": the compiler emits a guard variable checked on every call, plus a lock taken only during initialization); make it `constexpr` or `constinit` so it's initialized at compile time; or avoid non-trivial globals entirely. `constinit` requires the initializer to be a constant expression and fails to compile otherwise, which turns a hidden ordering hazard into an error. The mirror problem exists at shutdown: a static destructor may use another static that's already destroyed.

*Further reading:* [Static initialization order fiasco](https://en.cppreference.com/w/cpp/language/siof), [constinit](https://en.cppreference.com/w/cpp/language/constinit)

### Common dangling patterns

- Returning a reference or pointer to a local.
- A lambda capturing locals by reference that outlives the scope: stored callbacks, detached threads, `std::function` returned from a function. Capture by value instead (`[x]`, or an init-capture `[n = 0]`), and mark the lambda `mutable` if it must modify its copy.
- Holding a pointer, reference or iterator into a container across an operation that reallocates (:mod[containers]).
- `const char* p = some_string_temporary.c_str();`.
- A view (`string_view`, `span`) of a temporary.
- A reference returned by a function that returns one of its reference parameters, such as `std::max`, when the argument was a temporary.

Compilers catch some of these. Clang's `[[clang::lifetimebound]]` on a parameter (or on a member function, for `*this`) says the result refers to it, and Clang then warns when it's a temporary; `-Wdangling` and `-Wdangling-gsl` (Clang) and `-Wdangling-reference` (GCC 13+) catch common cases without annotations.

*Further reading:* [Return by reference and return by address](https://www.learncpp.com/cpp-tutorial/return-by-reference-and-return-by-address/), [Lambda captures](https://www.learncpp.com/cpp-tutorial/lambda-captures/), [std::string_view (part 2)](https://www.learncpp.com/cpp-tutorial/stdstring_view-part-2/)

### Destructors and exceptions

Destructors are implicitly `noexcept`. If one throws, `std::terminate` is called. Even with `noexcept(false)`, a destructor that throws while another exception is unwinding the stack terminates the program. Report failures in destructors some other way (log, set a flag) and offer an explicit `close()` that can throw.

*Further reading:* [Exception dangers and downsides](https://www.learncpp.com/cpp-tutorial/exception-dangers-and-downsides/), [Exception specifications and noexcept](https://www.learncpp.com/cpp-tutorial/exception-specifications-and-noexcept/)
