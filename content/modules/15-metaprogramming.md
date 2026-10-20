# Module 15: Metaprogramming and compile-time computation

Trading codebases push work to compile time: dispatch, configuration, lookup tables and interface checks, so the hot path does less. You need to read and write traits, concepts and CRTP fluently.

## Notes

### 15.1 Type traits

`<type_traits>` answers questions about types (`is_integral_v`, `is_trivially_copyable_v`, `is_nothrow_move_constructible_v`) and transforms them (`remove_cvref_t`, `decay_t`, `add_pointer_t`, `conditional_t<B, A, B>`, `common_type_t`, `invoke_result_t`). Traits are just class templates specialized on patterns:

```cpp kind=fragment run=none
template <class T> struct is_pointer : std::false_type {};
template <class T> struct is_pointer<T*> : std::true_type {};
```

`std::declval<T>()` pretends to produce a `T` in unevaluated contexts (`decltype`, `noexcept`, `sizeof`), even for types without accessible constructors.

### 15.2 SFINAE (the pre-C++20 way)

"Substitution failure is not an error": if substituting template arguments into a function template's signature produces an invalid type or expression, that overload is silently discarded. Only failures in the *immediate context* (the signature, default template arguments) count; an error inside the function body is a hard error.

Tools: `std::enable_if_t<Cond, int> = 0` as a template parameter, trailing return types like `-> decltype(t.size(), void())`, and the detection idiom with `std::void_t`. All of it is legal but hard to read; concepts replace it.

### 15.3 Concepts (C++20)

```cpp kind=fragment run=none
template <class T>
concept MarketDataHandler = requires(T h, const Trade& t, const Quote& q) {
    { h.on_trade(t) } noexcept;
    { h.on_quote(q) } noexcept;
};
```

Use them as `template <MarketDataHandler H>`, `requires` clauses, or `void run(MarketDataHandler auto& h)`. Benefits: readable constraints, errors that point at the unmet requirement, and overloading by constraint. When two overloads are both viable, the one whose constraints *subsume* the other's (logically imply it, using the same named concepts) is preferred. A `requires` expression can also be used directly as a `bool`: `if constexpr (requires { t.reserve(n); })`.

### 15.4 `if constexpr` and tag dispatch

`if constexpr (cond)` discards the untaken branch in a template, so it doesn't have to compile for that `T`. Outside templates, both branches are still checked. Tag dispatch, the older technique, overloads on tag types like `std::random_access_iterator_tag` to select implementations.

### 15.5 CRTP and deducing `this`

The curiously recurring template pattern: `struct Derived : Base<Derived>`. `Base` can call `static_cast<Derived*>(this)->impl()`, giving static polymorphism with no vtable and full inlining. Uses: shared interface code, mixins (`Comparable<T>`, `Counted<T>`), compile-time interfaces for handlers. Weakness: nothing stops `struct B : Base<A>`; guard it with a private constructor and `friend Derived;`.

C++23's explicit object parameter ("deducing `this`") replaces many CRTP uses: `void run(this auto& self) { self.impl(); }` in a plain base class deduces the derived type at the call site.

### 15.6 Policy-based design

Make behavior a template parameter: `Logger<Sink, LockPolicy>`, `OrderBook<PriceLevelStore, Allocator>`. A `NullLock` policy with empty `lock()`/`unlock()` compiles to nothing for single-threaded use. Same code, zero runtime cost, chosen at compile time.

### 15.7 Compile-time computation

- `constexpr` functions can run at compile time; since C++20 they can use `std::vector`, `std::string` (transiently: memory must be freed before the evaluation ends), `try`, virtual calls and `dynamic_cast`.
- `consteval` functions must run at compile time; `constinit` forces static initialization.
- `if consteval` (C++23) branches on whether evaluation is at compile time; `std::is_constant_evaluated()` is the older form.
- Lookup tables (CRC, popcount, FIX tag maps, decimal powers) are classic uses: build a `std::array` in a `constexpr` function.
- Core-language UB during constant evaluation is a compile error (\[expr.const\]), a free UB detector for tests. Library UB isn't guaranteed to be caught: whether such an expression counts as constant is unspecified.

## Predict the output

**P1**

```cpp kind=fragment run=local
using namespace std;
cout << is_same_v<int, remove_cvref_t<const int&>>
     << is_same_v<decay_t<int[3]>, int*>
     << is_same_v<decay_t<const int>, int>
     << is_same_v<remove_const_t<const int*>, int*>;
```

**P2**

```cpp kind=fragment run=local
template <class T>
auto describe(const T& t) -> decltype(t.size(), void()) { cout << "container "; }
void describe(...) { cout << "other "; }
describe(std::vector<int>{}); describe(42);
```

**P3**

```cpp kind=fragment run=local
template <class T> concept Num = std::integral<T> || std::floating_point<T>;
template <class T> concept Int = Num<T> && std::integral<T>;
void f(Num auto) { cout << "num "; }
void f(Int auto) { cout << "int "; }
f(1); f(1.0);
```

**P4**

```cpp kind=fragment run=local
template <class T> auto len(const T& t) {
    if constexpr (requires { t.size(); }) return t.size();
    else return 1;
}
cout << len(std::string("abc")) << len(5);
```

**P5**

```cpp kind=fragment run=local
template <class D> struct Base {
    void run() { static_cast<D*>(this)->impl(); }
    void impl() { cout << "base "; }
};
struct A : Base<A> { void impl() { cout << "A "; } };
struct B : Base<B> {};
A{}.run(); B{}.run();
```

**P6**

```cpp kind=fragment run=local
consteval int sq(int x) { return x * x; }
int n = 3;
cout << sq(4);
// cout << sq(n);   // what happens if uncommented?
```

## Spot the bug or UB

**U1**

```cpp kind=fragment run=none
template <class D> struct Shape {
    double area() { return static_cast<D*>(this)->area_impl(); }
};
struct Circle : Shape<Circle> { double area_impl(); };
struct Square : Shape<Circle> { double area_impl(); };
Square{}.area();
```

**U2**

```cpp kind=fragment run=local
template <class T> void encode(T v) {
    if constexpr (std::is_integral_v<T>) { /* ... */ }
    else static_assert(false, "unsupported type");
}
```

**U3**

```cpp kind=fragment run=local
constexpr int next(int x) { return x + 1; }
int a = next(INT_MAX);
constexpr int b = next(INT_MAX);
```

**U4**

```cpp kind=fragment run=local
template <class T, class = std::enable_if_t<std::is_integral_v<T>>>
void store(T);
template <class T, class = std::enable_if_t<std::is_floating_point_v<T>>>
void store(T);
```

## Exercises

**E1 ★ Traits by hand.** Implement `is_same`, `remove_reference`, `remove_cv`, `conditional`, `is_pointer` and `decay` (simplified), each with `static_assert` tests mirroring the standard versions.

**E2 ★★ Detection three ways.** Detect whether a type has `reserve(size_t)` with `void_t`, with a trailing `decltype` overload, and with a `requires` expression. Use it in `append_all(container, range)` that reserves only when possible.

**E3 ★★ Handler interface.** Define the `MarketDataHandler` concept from 15.3, then implement a dispatcher that accepts any conforming handler, once with CRTP and once with deducing `this`. Make a non-conforming handler fail with a readable error. Compare the assembly of a dispatch call against a virtual version.

**E4 ★★ Policies.** Implement `Logger<SinkPolicy, LockPolicy>` with `StdoutSink`/`BufferSink` and `NullLock`/`MutexLock`. Show on Compiler Explorer that `NullLock` leaves no trace in the generated code.

**E5 ★★★ Compile-time tables.** Generate a CRC32 table with a `constexpr` function, then write a `consteval` parser that turns a string like `"35=D|49=SNDR|56=TRGT"` into a `std::array` of (tag, value) pairs at compile time, verified with `static_assert`.

**E6 ★★★ Tuple algorithms.** Implement `tuple_for_each(t, f)` and `tuple_transform(t, f)` using `std::index_sequence` and a fold, then rewrite them with C++26 structured binding packs if your compiler supports them.

## Interview questions

1. What is SFINAE? What's the "immediate context"?
2. `enable_if` vs concepts: what do concepts improve?
3. What is CRTP and when would you use it over virtual functions?
4. How does deducing `this` change CRTP?
5. What is tag dispatch?
6. `constexpr` vs `consteval` vs `constinit`?
7. When do you use `if constexpr` instead of overloading?
8. Explain policy-based design and why it suits low-latency code.
9. How would you implement `std::is_same` and `std::remove_reference`?
10. What does `std::declval` do?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `1110` | `const int*` is a pointer to const; its top level isn't const, so `remove_const` leaves it alone. |
| P2 | ` container other  ` | For `int`, `t.size()` fails in the trailing return type, so SFINAE removes that overload. |
| P3 | ` int num  ` | `Int` subsumes `Num` because it's defined as `Num<T> && ...`. |
| P4 | `31` | Each instantiation has only one live `return`, so return-type deduction is consistent. |
| P5 | ` A base  ` | `B` doesn't define `impl`, so lookup finds `Base<B>::impl`. |
| P6 | `16`; uncommented: compile error | `sq(n)` isn't a constant expression. |

### Spot the bug or UB

- **U1:** UB: `Square` derives from `Shape<Circle>`, so `area()` casts a `Square` to `Circle`. Prevent it with a private constructor in `Shape` and `friend D;`.
- **U2:** Ill-formed before C++23 even when the branch is discarded; P2593 (adopted as a defect report) makes `static_assert(false)` in a discarded branch fine, and current Clang and GCC accept it. The portable old trick is a dependent false: `static_assert(sizeof(T) == 0, ...)`.
- **U3:** `a` is runtime UB (signed overflow, not diagnosed). `b` is a compile error, because constant evaluation must diagnose UB.
- **U4:** Doesn't compile: both declare the same template signature (default template arguments aren't part of it). Use `std::enable_if_t<..., int> = 0` as a non-type parameter, or concepts.

### Exercise hints

- **E1:** `decay` is `remove_reference`, then: arrays become pointers, functions become function pointers, otherwise `remove_cv`.
- **E3:** Both CRTP and deducing `this` produce a direct, inlinable call; the virtual version has a load and an indirect call.
- **E5:** In a `consteval` function you can use a local `std::array` and loops; return the array by value.

### Interview questions

1. When substituting template arguments makes a declaration invalid, that candidate is dropped instead of causing an error. Only the signature and template parameter defaults are the immediate context; errors in bodies are hard errors.
2. Readable named constraints, clear diagnostics, overloading by constraint with subsumption, and constrained `auto`.
3. A base template parameterized on the derived class, giving static dispatch. Use it when the types are known at compile time and the call must be inlined; virtual functions when you need runtime heterogeneity.
4. A non-template base with `this auto& self` deduces the derived type at each call, removing the template parameter, the casts and the misuse risk.
5. Selecting an overload by passing an empty tag object whose type encodes a property, like iterator categories.
6. See Module 1 table 1.8: may run at compile time / must run at compile time / static initialization guaranteed but mutable.
7. When the variants are small and local to one function, or when branches wouldn't compile for some types. Overloading or concepts scale better for public APIs.
8. Behaviors (locking, allocation, logging) are template parameters selected at compile time, so unused features cost nothing and everything inlines.
9. `is_same`: primary `false_type`, partial specialization `<T, T>` is `true_type`. `remove_reference`: primary `type = T`, specializations for `T&` and `T&&` with `type = T`.
10. Returns an rvalue reference to `T` for use in unevaluated expressions only, so you can ask about expression validity and types without constructing anything.
