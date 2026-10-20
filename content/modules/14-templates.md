# Module 14: Templates

Templates are how C++ gets zero-cost abstraction: code is generated per type at compile time, so it can be fully inlined. Go generics are mostly implemented with dictionaries and GC shape stenciling; C++ templates are always fully monomorphized.

## Notes

### 14.1 Kinds of templates

Function templates, class templates, alias templates (`template <class T> using Vec = std::vector<T, MyAlloc<T>>;`), and variable templates (`template <class T> constexpr bool is_small_v = sizeof(T) <= 16;`). C++20 abbreviated syntax: `void log(const auto& x)` is a function template.

### 14.2 Argument deduction

| Parameter | Argument `const int[3]` lvalue | Argument `int` lvalue | Argument `int` rvalue |
| --- | --- | --- | --- |
| `T` (by value) | `T = const int*` (decays, drops top-level const) | `int` | `int` |
| `T&` | `T = const int[3]` | `int` | Doesn't bind |
| `const T&` | `T = int[3]` | `int` | `int` |
| `T&&` (forwarding) | `T = const int(&)[3]` | `int&` | `int` |

Deduction doesn't consider implicit conversions: `template <class T> T max(T, T); max(1, 2.0);` fails because `T` can't be both `int` and `double`. Fix with explicit arguments (`max<double>(1, 2.0)`) or two type parameters.

### 14.3 Template parameters

- Type parameters (`class T` / `typename T`).
- Non-type template parameters (NTTPs): integers, enums, pointers, and since C++20 floating-point values and structural class types, which enables string literals as template arguments via a `FixedString` type.
- Template template parameters: `template <template <class> class Container>`.
- Defaults are allowed for all of them.

### 14.4 Specialization

- **Full specialization:** `template <> struct Hash<Price> { ... };`.
- **Partial specialization** (class and variable templates only): `template <class T> struct IsPointer<T*> : std::true_type {};`.
- Function templates can't be partially specialized, and full specializations don't participate in overload resolution: the compiler first chooses among *primary templates* and non-template overloads, then checks for a specialization of the winner. Prefer overloading functions to specializing them.
- A specialization must be declared before any use that would instantiate the primary; otherwise the program is ill-formed with no diagnostic required.

### 14.5 Instantiation and lookup

Templates are instantiated in each TU that uses them (implicitly inline for ODR purposes). `template class Ring<int>;` explicitly instantiates; `extern template class Ring<int>;` tells other TUs not to, saving compile time.

*Two-phase lookup:* names that don't depend on template parameters are looked up when the template is defined; dependent names, when it's instantiated. Consequences:

- A dependent qualified name that's a type needs `typename`: `typename T::value_type x;`.
- A dependent member template needs `template`: `t.template get<0>()`.
- Members inherited from a dependent base aren't found by unqualified lookup; write `this->member` or `Base<T>::member`.

### 14.6 Variadic templates and folds

`template <class... Ts> void f(Ts... args)` takes a pack. `sizeof...(Ts)` counts it; a pattern followed by `...` expands it: `g(std::forward<Ts>(args)...)`. C++17 fold expressions replace recursion: `(args + ...)` (unary right), `(... + args)` (unary left), `(args + ... + 0)` (binary right). Empty unary folds are only allowed for `&&` (true), `||` (false) and `,` (void). C++26 adds pack indexing: `Ts...[0]`.

### 14.7 CTAD

Class template argument deduction (C++17) lets `std::vector v{1, 2, 3};` deduce `std::vector<int>`. Deduction guides tell the compiler how to deduce from constructor arguments. Watch out for braces: `std::vector v2{v.begin(), v.end()}` is a vector of two iterators.

## Predict the output

**P1**

```cpp kind=fragment run=local note="In the browser this is wasm32, where `long` and pointers are 32-bit: the decayed int* is 4 bytes, so this prints 4 40."
template <class T> void by_val(T)  { cout << sizeof(T) << ' '; }
template <class T> void by_ref(T&) { cout << sizeof(T) << ' '; }
int arr[10];
by_val(arr); by_ref(arr);
```

**P2a**

```cpp kind=fragment run=local
template <class T> void f(T)  { cout << 'a'; }
template <class T> void f(T*) { cout << 'b'; }
template <> void f(int*)      { cout << 'c'; }
int* p = nullptr; f(p);
```

**P2b** (same declarations, but the specialization comes second)

```cpp kind=fragment run=local
template <class T> void f(T)  { cout << 'a'; }
template <> void f(int*)      { cout << 'c'; }
template <class T> void f(T*) { cout << 'b'; }
int* p = nullptr; f(p);
```

**P3**

```cpp kind=fragment run=local
template <class... Ts> auto sum(Ts... ts)   { return (ts + ... + 0); }
template <class... Ts> auto sub_l(Ts... ts) { return (... - ts); }
template <class... Ts> auto sub_r(Ts... ts) { return (ts - ...); }
cout << sum(1, 2, 3) << ' ' << sub_l(10, 2, 3) << ' ' << sub_r(10, 2, 3);
```

**P4**

```cpp kind=fragment run=local
template <class... Ts> constexpr std::size_t n(Ts...) { return sizeof...(Ts); }
cout << n() << n(1, "a", 2.0);
```

**P5**

```cpp kind=fragment run=local
std::vector v{1, 2, 3};
std::vector v2{v.begin(), v.end()};
cout << v2.size();
```

**P6**

```cpp kind=fragment run=local
template <class T> struct Base { void hello() { cout << "hi"; } };
template <class T> struct Der : Base<T> {
    void go() { hello(); }
};
```

## Spot the bug

**U1**

```cpp kind=fragment run=none
// traits.h
template <class T> struct Traits { static constexpr int width = 8; };
// a.cpp: uses Traits<Price>::width
// b.cpp:
template <> struct Traits<Price> { static constexpr int width = 16; };
```

**U2**

```cpp kind=fragment run=none
template <class T>
const T& clamp_ref(const T& v, const T& lo, const T& hi) {
    return v < lo ? lo : (hi < v ? hi : v);
}
const int& r = clamp_ref(x, 0, 100);
std::cout << r;
```

**U3**

```cpp kind=fragment run=local
template <class Container>
void print_first(const Container& c) {
    Container::const_iterator it = c.begin();
    std::cout << *it;
}
```

**U4**

```cpp kind=fragment run=local
template <class T> T max_of(T a, T b) { return a < b ? b : a; }
auto m = max_of(qty, 2.5);   // qty is int
```

## Exercises

**E1 ★ Common type.** Write `max_of(a, b)` accepting two different arithmetic types and returning `std::common_type_t`. Test with `int`/`double`, `unsigned`/`int` (and note the danger), and `int64_t`/`int32_t`.

**E2 ★★ `print(args...)`.** Implement a variadic `print` that separates arguments with ", " using a fold over the comma operator, with no trailing separator. Then a `format_into(buf, args...)` variant that writes into a fixed `char` buffer without allocating.

**E3 ★★ Type list toolkit.** Implement `TypeList<Ts...>` with `Length`, `Front`, `PushFront`, `Contains<T>` and `IndexOf<T>` using partial specialization and folds. Test everything with `static_assert`.

**E4 ★★ String NTTPs.** Implement `FixedString<N>` usable as an NTTP (C++20), then `Field<"price", int64_t>` and `Message<Field<...>...>` where `get<"price">(msg)` is resolved at compile time.

**E5 ★★★ Compile-time dispatch table.** Given message handlers as types each declaring `static constexpr char type` (like `'A'`, `'E'`, `'X'`), generate a 256-entry `constexpr` array of function pointers from a parameter pack, and dispatch raw bytes by type with one indexed call. Benchmark against a virtual-function design.

**E6 ★★ Compile time.** Put a heavy template (for example a big `std::variant` visitor) in a header used by 20 TUs. Measure build time, then add explicit instantiation in one TU with `extern template` elsewhere and measure again.

## Interview questions

1. How does template argument deduction work for `T`, `T&` and `T&&` parameters?
2. Why can't you partially specialize a function template? What do you do instead?
3. What's the difference between specializing and overloading a function template?
4. Explain two-phase lookup and why `typename` and `this->` are sometimes needed.
5. Why do templates usually live in headers?
6. How do you reduce template code bloat and compile times?
7. What are fold expressions? Give a unary and a binary example.
8. What's new about NTTPs in C++20?
9. What is CTAD, and what's a deduction guide?
10. Compare C++ templates with Go generics.

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | ` 8 40  ` | By value decays to `int*`; by reference keeps `int[10]`. |
| P2a | `c` | Overload resolution picks the primary `f(T*)` (more specialized); `f<int*>` specializes it. |
| P2b | `b` | The specialization was declared when only `f(T)` existed, so it specializes `f(T)`. Resolution picks primary `f(T*)`, which has no specialization. |
| P3 | `6 5 11` | Left fold: (10 − 2) − 3. Right fold: 10 − (2 − 3). |
| P4 | `03` |  |
| P5 | `2` | Braces with CTAD prefer the `initializer_list` constructor, deducing `vector<vector<int>::iterator>`. |
| P6 | Doesn't compile | `hello` isn't found in the dependent base during phase one; write `this->hello()`. (MSVC's permissive mode accepts it.) |

### Spot the bug

- **U1:** ODR violation, no diagnostic required: `a.cpp` instantiates the primary for `Price`, `b.cpp` uses the specialization. Declare the specialization in `traits.h` next to the primary.
- **U2:** `0` and `100` bind to temporaries that die at the end of the statement. If `x` is out of range, `r` dangles. Return by value for small types. (`std::clamp` has the same trap.)
- **U3:** Doesn't compile: `Container::const_iterator` is a dependent type and needs `typename`. Or just write `auto`.
- **U4:** Doesn't compile: `T` deduces to `int` from one argument and `double` from the other. Use `max_of<double>(qty, 2.5)` or two type parameters.

### Exercise hints

- **E1:** `unsigned` and `int` have common type `unsigned`, so `max_of(-1, 1u)` returns a huge value. Constrain or use `std::cmp_less`.
- **E2:** `((std::cout << (first ? "" : ", ") << args, first = false), ...);` with `bool first = true;`.
- **E5:** Build the table with an immediately invoked `consteval` lambda that loops over the pack via a fold, assigning `table[Handlers::type] = &Handlers::handle`.

### Interview questions

1. See table 14.2: by value decays and strips top-level cv; `T&` preserves cv and arrays; `T&&` deduces `U&` for lvalues and `U` for rvalues. No implicit conversions during deduction.
2. The language doesn't allow it. Use overloading, or delegate to a class template that can be partially specialized, or `if constexpr`/concepts.
3. Overloads compete in resolution. A specialization doesn't compete; it's only used if its primary template wins, which leads to surprises like P2b.
4. Non-dependent names bind at definition, dependent names at instantiation. The compiler can't know whether `T::x` is a type or value, so `typename` says it's a type, and it doesn't search dependent bases without `this->`.
5. The full definition is needed wherever it's instantiated. Explicit instantiation lets you move definitions to a `.cpp` for a fixed set of types.
6. Hoist type-independent code into non-template helpers, use type erasure at boundaries, explicit instantiation with `extern template`, fewer heavy headers, modules.
7. Expansions of a pack over a binary operator. Unary: `(args && ...)`. Binary: `(args + ... + 0)`, which handles empty packs.
8. Floating-point values and structural class types (all-public, constexpr-constructible) can be template arguments, enabling compile-time strings and configuration objects.
9. Deducing class template arguments from constructor arguments. A deduction guide maps constructor argument types to template arguments, e.g. iterator pairs to the element type.
10. C++ instantiates a separate copy per type (fast, inlinable, bigger binaries, slower builds) and type-checks at instantiation (concepts add earlier checks). Go type-checks generics up front and shares code across types with the same GC shape, passing a dictionary, which is smaller but often slower.
