### Type traits

`<type_traits>` answers questions about types (`is_integral_v`, `is_trivially_copyable_v`, `is_nothrow_move_constructible_v`) and transforms them (`remove_cvref_t`, `decay_t`, `add_pointer_t`, `conditional_t<B, A, B>`, `common_type_t`, `invoke_result_t`). Traits are just class templates specialized on patterns:

```cpp kind=fragment run=none
template <class T> struct is_pointer : std::false_type {};
template <class T> struct is_pointer<T*> : std::true_type {};
```

`std::declval<T>()` pretends to produce a `T` in unevaluated contexts (`decltype`, `noexcept`, `sizeof`), even for types without accessible constructors.

### SFINAE (the pre-C++20 way)

"Substitution failure is not an error": if substituting template arguments into a function template's signature produces an invalid type or expression, that overload is silently discarded. Only failures in the *immediate context* (the signature, default template arguments) count; an error inside the function body is a hard error.

Tools: `std::enable_if_t<Cond, int> = 0` as a template parameter, trailing return types like `-> decltype(t.size(), void())`, and the detection idiom with `std::void_t`. All of it is legal but hard to read; concepts replace it.

### Concepts (C++20)

```cpp kind=fragment run=none
template <class T>
concept MarketDataHandler = requires(T h, const Trade& t, const Quote& q) {
    { h.on_trade(t) } noexcept;
    { h.on_quote(q) } noexcept;
};
```

Use them as `template <MarketDataHandler H>`, `requires` clauses, or `void run(MarketDataHandler auto& h)`. Benefits: readable constraints, errors that point at the unmet requirement, and overloading by constraint. When two overloads are both viable, the one whose constraints *subsume* the other's (logically imply it, using the same named concepts) is preferred. A `requires` expression can also be used directly as a `bool`: `if constexpr (requires { t.reserve(n); })`.

### `if constexpr` and tag dispatch

`if constexpr (cond)` discards the untaken branch in a template, so it doesn't have to compile for that `T`. Outside templates, both branches are still checked. Tag dispatch, the older technique, overloads on tag types like `std::random_access_iterator_tag` to select implementations.

### CRTP and deducing `this`

The curiously recurring template pattern: `struct Derived : Base<Derived>`. `Base` can call `static_cast<Derived*>(this)->impl()`, giving static polymorphism with no vtable and full inlining. Uses: shared interface code, mixins (`Comparable<T>`, `Counted<T>`), compile-time interfaces for handlers. Weakness: nothing stops `struct B : Base<A>`; guard it with a private constructor and `friend Derived;`.

C++23's explicit object parameter ("deducing `this`") replaces many CRTP uses: `void run(this auto& self) { self.impl(); }` in a plain base class deduces the derived type at the call site.

### Policy-based design

Make behavior a template parameter: `Logger<Sink, LockPolicy>`, `OrderBook<PriceLevelStore, Allocator>`. A `NullLock` policy with empty `lock()`/`unlock()` compiles to nothing for single-threaded use. Same code, zero runtime cost, chosen at compile time.

### Compile-time computation

- `constexpr` functions can run at compile time; since C++20 they can use `std::vector`, `std::string` (transiently: memory must be freed before the evaluation ends), `try`, virtual calls and `dynamic_cast`.
- `consteval` functions must run at compile time; `constinit` forces static initialization.
- `if consteval` (C++23) branches on whether evaluation is at compile time; `std::is_constant_evaluated()` is the older form.
- Lookup tables (CRC, popcount, FIX tag maps, decimal powers) are classic uses: build a `std::array` in a `constexpr` function.
- Core-language UB during constant evaluation is a compile error (\[expr.const\]), a free UB detector for tests. Library UB isn't guaranteed to be caught: whether such an expression counts as constant is unspecified.
