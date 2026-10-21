### Storage duration and lifetime

| Storage | Created | Destroyed |
| --- | --- | --- |
| Automatic | When the declaration executes | At the end of its scope, in reverse order |
| Static | Namespace scope: before `main` (mostly). Function-local: first time control passes the declaration | After `main` returns, in reverse order of construction |
| Thread | Per thread, at first use or thread start | At thread exit |
| Dynamic | `new` | `delete` |

An object's lifetime begins when its initialization completes and ends when its destructor starts. Accessing it outside that window through a pointer or reference is UB, even if the memory is still there.

Destruction order mirrors construction: members in reverse declaration order, then bases in reverse order. If a constructor throws, the object's destructor does not run, but every fully constructed member and base is destroyed.

### RAII

Acquire a resource in a constructor and release it in the destructor: memory (`unique_ptr`), locks (`lock_guard`), file descriptors, sockets, timers. Because destructors run during stack unwinding, cleanup happens on every exit path, including exceptions. It's Go's `defer` generalized and bound to a value you can move around.

### Temporaries and lifetime extension

A temporary is destroyed at the end of the *full-expression* that created it (roughly, at the semicolon). One exception: binding a prvalue directly to a local `const T&` or `T&&` extends the temporary's life to the reference's scope. Extension does not happen when:

- The reference comes from a function's return value: `const auto& m = std::max(a, std::string("z"));` dangles if the temporary is the larger one.
- The temporary is bound in a `return` statement or to a reference parameter.
- You call a member function that returns a reference into the temporary: `auto& n = make().name();`.
- A `std::string_view`, `std::span` or other view is constructed from it; views aren't references, so nothing is extended.

Range-`for` over an expression like `for (int x : make().items())` was a classic dangling bug: only the final `items()` result is extended, not `make()`'s temporary. C++23 (P2718) extends all temporaries in the range initializer, fixing it. Still avoid the pattern when supporting older standards.

### Static initialization order

Within one TU, namespace-scope statics initialize in declaration order. Across TUs, the order is unspecified. A global constructor in one file that reads a global from another may see it unconstructed: the *static initialization order fiasco*.

Fixes: make the dependency a function-local static ("construct on first use"), which C++11 guarantees is initialized exactly once even with concurrent callers ("magic statics"); make it `constexpr` or `constinit` so it's initialized at compile time; or avoid non-trivial globals entirely. The mirror problem exists at shutdown: a static destructor may use another static that's already destroyed.

### Common dangling patterns

- Returning a reference or pointer to a local.
- A lambda capturing locals by reference that outlives the scope: stored callbacks, detached threads, `std::function` returned from a function.
- Holding a pointer, reference or iterator into a container across an operation that reallocates (:mod[containers]).
- `const char* p = some_string_temporary.c_str();`.
- A view (`string_view`, `span`) of a temporary.

### Destructors and exceptions

Destructors are implicitly `noexcept`. If one throws, `std::terminate` is called. Even with `noexcept(false)`, a destructor that throws while another exception is unwinding the stack terminates the program. Report failures in destructors some other way (log, set a flag) and offer an explicit `close()` that can throw.
