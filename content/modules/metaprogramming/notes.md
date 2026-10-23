### Type traits

`<type_traits>` answers questions about types (`is_integral_v`, `is_trivially_copyable_v`, `is_nothrow_move_constructible_v`) and transforms them (`remove_cvref_t`, `decay_t`, `add_pointer_t`, `conditional_t<Cond, A, B>`, `common_type_t`, `invoke_result_t`). Traits are just class templates specialized on patterns:

```cpp kind=fragment run=none
template <class T> struct is_pointer : std::false_type {};
template <class T> struct is_pointer<T*> : std::true_type {};

template <class A, class B> struct is_same : std::false_type {};
template <class T> struct is_same<T, T> : std::true_type {};

template <class T> struct remove_reference { using type = T; };
template <class T> struct remove_reference<T&> { using type = T; };
template <class T> struct remove_reference<T&&> { using type = T; };
```

The `_v` and `_t` forms are shorthands: `is_same_v<A, B>` is `is_same<A, B>::value`, and `remove_reference_t<T>` is `typename remove_reference<T>::type`.

Two transformations worth knowing exactly:

- `remove_const` (and `remove_cv`, `remove_cvref`) remove only *top-level* qualifiers, the ones on the type itself. `const int*` is a non-const pointer to `const int`, so `remove_const_t<const int*>` is still `const int*`; `int* const` becomes `int*`.
- `decay_t<T>` is the type a by-value parameter would get: remove the reference, then arrays become pointers to their first element (`int[3]` → `int*`), functions become function pointers, and anything else loses its top-level `const` and `volatile`.

`std::declval<T>()` is declared to return `std::add_rvalue_reference_t<T>` and has no definition, so it may appear only in unevaluated contexts (`decltype`, `noexcept`, `sizeof`, `requires`); it pretends to produce a `T`, even for types without accessible constructors, so you can ask what an expression's type would be.

### SFINAE (the pre-C++20 way)

"Substitution failure is not an error": if substituting template arguments into a function template's signature produces an invalid type or expression, that overload is silently discarded. Only failures in the *immediate context* (the function type, its template parameter list including defaults, and a trailing return type) count; an error inside the function body is a hard error.

Tools:

- `std::enable_if_t<Cond, int> = 0` as a non-type template parameter. Writing it as a defaulted *type* parameter (`class = std::enable_if_t<Cond>`) breaks as soon as you have two overloads: default template arguments aren't part of a function template's signature, so two such declarations differing only in the default declare the same template twice.
- Trailing return types like `-> decltype(t.size(), void())`: the comma operator checks `t.size()` and makes the type `void`.
- A C-style variadic overload `f(...)` as the fallback: any argument converts to `...`, but that's ranked below every other conversion, so it's chosen only when nothing else is viable.
- The detection idiom with `std::void_t`, which maps any valid types to `void`:

```cpp kind=fragment
template <class T, class = void> struct has_size : std::false_type {};
template <class T> struct has_size<T, std::void_t<decltype(std::declval<T&>().size())>> : std::true_type {};

static_assert(has_size<std::string>::value && !has_size<int>::value);
```

All of it is legal but hard to read; concepts replace it.

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

`if constexpr (cond)` discards the untaken branch in a template: its statements aren't instantiated for that `T`, so code that wouldn't compile for that type is fine there. The discarded branch is still parsed, and errors that don't depend on `T` are still errors. `static_assert(false, "...")` in a discarded branch was ill-formed (no diagnostic required, but compilers rejected it) until P2593, adopted for C++23 as a defect report against earlier standards; the portable workaround is a condition that depends on `T`, such as `sizeof(T) == 0`. Outside templates, both branches are always checked. A `return` in a discarded branch doesn't take part in return-type deduction, so each instantiation of an `auto` function deduces from its live returns only, and the branches may return different types.

Tag dispatch, the older technique, passes an empty object whose type encodes a property (like `std::random_access_iterator_tag`) and overloads on that type to select an implementation.

*Further reading:* [Constexpr if statements](https://www.learncpp.com/cpp-tutorial/constexpr-if-statements/)

### CRTP and deducing `this`

The curiously recurring template pattern: `struct Derived : Base<Derived>`. `Base` can call `static_cast<Derived*>(this)->impl()`, giving static polymorphism with no vtable and full inlining. Uses: shared interface code, mixins (`Comparable<T>`, `Counted<T>`), compile-time interfaces for handlers. Choose it over virtual functions when the concrete type is known at compile time and the call must inline; virtual functions remain the tool for runtime heterogeneity (a container of different handler types).

The call `static_cast<Derived*>(this)->impl()` is ordinary name lookup in `Derived`: if `Derived` doesn't declare `impl`, lookup continues into its bases and finds the base's own member of that name, if there is one, silently. (If the base's version is the forwarding function itself, that's infinite recursion.) Weakness: nothing stops `struct B : Base<A>`, and then the cast is to a type the object isn't, which is UB. Guard it with a private constructor in `Base` and `friend Derived;`, so only `Derived` can construct the base.

C++23's explicit object parameter ("deducing `this`") replaces many CRTP uses: `void run(this auto& self) { self.impl(); }` in a plain base class deduces the derived type at the call site, with no template parameter on the base and no cast.

### Policy-based design

Make behavior a template parameter: `Logger<Sink, LockPolicy>`, `OrderBook<PriceLevelStore, Allocator>`. A `NullLock` policy with empty `lock()`/`unlock()` compiles to nothing for single-threaded use. Same code, zero runtime cost, chosen at compile time. Store stateless policies with `[[no_unique_address]]` (or as empty base classes) so they don't add a byte of padding to the object.

### Compile-time computation

- `constexpr` functions can run at compile time; since C++20 they can use `std::vector`, `std::string` (transiently: memory must be freed before the evaluation ends), `try`, virtual calls and `dynamic_cast`. Called where a constant isn't required, such as initializing a plain `int`, a `constexpr` function usually just runs at runtime under the ordinary rules, UB included.
- `consteval` functions must run at compile time: every call must itself be a constant expression (unless it's inside another immediate function), so its arguments must be constants. `consteval int sq(int)` called with a non-`constexpr` variable doesn't compile. `constinit` forces static initialization (:sec[types-and-initialization/the-const-family]).
- `if consteval` (C++23) branches on whether evaluation is at compile time; `std::is_constant_evaluated()` is the older form.
- Lookup tables (CRC, popcount, FIX tag maps, decimal powers) are classic uses: build a `std::array` in a `constexpr` function, with loops and local variables, and return it by value.
- Core-language UB during constant evaluation is a compile error (\[expr.const\]), a free UB detector for tests. Library UB isn't guaranteed to be caught: whether such an expression counts as constant is unspecified.

*Further reading:* [Constexpr functions](https://www.learncpp.com/cpp-tutorial/constexpr-functions/), [Constexpr functions (part 2)](https://www.learncpp.com/cpp-tutorial/constexpr-functions-part-2/), [Constexpr functions (part 3) and consteval](https://www.learncpp.com/cpp-tutorial/constexpr-functions-part-3-and-consteval/), [Constexpr functions (part 4)](https://www.learncpp.com/cpp-tutorial/constexpr-functions-part-4/)

### Index sequences and tuples

To touch each element of a `std::tuple` you need its indices as a pack, because `std::get<I>` takes a compile-time index. `std::make_index_sequence<N>` is the type `std::index_sequence<0, 1, …, N-1>`; a function template that deduces `std::size_t... I` from it gets the indices as a pack and expands them with a fold:

```cpp kind=fragment
auto t = std::tuple{1, 2.5, 'x'};
[&]<std::size_t... I>(std::index_sequence<I...>) {
    ((cout << std::get<I>(t) << ' '), ...);
}(std::make_index_sequence<std::tuple_size_v<decltype(t)>>{});
```

`std::apply(f, t)` does the common case, calling `f` with the elements as arguments. C++26 structured binding packs remove the index plumbing: inside a template, `auto& [...xs] = t;` introduces a pack `xs` you can expand directly.
