### Kinds of templates

Function templates, class templates, alias templates (`template <class T> using Vec = std::vector<T, MyAlloc<T>>;`), and variable templates (`template <class T> constexpr bool is_small_v = sizeof(T) <= 16;`). C++20 abbreviated syntax: `void log(const auto& x)` is a function template.

### Argument deduction

| Parameter | Argument `const int[3]` lvalue | Argument `int` lvalue | Argument `int` rvalue |
| --- | --- | --- | --- |
| `T` (by value) | `T = const int*` (decays, drops top-level const) | `int` | `int` |
| `T&` | `T = const int[3]` | `int` | Doesn't bind |
| `const T&` | `T = int[3]` | `int` | `int` |
| `T&&` (forwarding) | `T = const int(&)[3]` | `int&` | `int` |

Deduction doesn't consider implicit conversions: `template <class T> T max(T, T); max(1, 2.0);` fails because `T` can't be both `int` and `double`. Fix with explicit arguments (`max<double>(1, 2.0)`) or two type parameters.

### Template parameters

- Type parameters (`class T` / `typename T`).
- Non-type template parameters (NTTPs): integers, enums, pointers, and since C++20 floating-point values and structural class types, which enables string literals as template arguments via a `FixedString` type.
- Template template parameters: `template <template <class> class Container>`.
- Defaults are allowed for all of them.

### Specialization

- **Full specialization:** `template <> struct Hash<Price> { ... };`.
- **Partial specialization** (class and variable templates only): `template <class T> struct IsPointer<T*> : std::true_type {};`.
- Function templates can't be partially specialized, and full specializations don't participate in overload resolution: the compiler first chooses among *primary templates* and non-template overloads, then checks for a specialization of the winner. Prefer overloading functions to specializing them.
- A specialization must be declared before any use that would instantiate the primary; otherwise the program is ill-formed with no diagnostic required.

### Instantiation and lookup

Templates are instantiated in each TU that uses them (implicitly inline for ODR purposes). `template class Ring<int>;` explicitly instantiates; `extern template class Ring<int>;` tells other TUs not to, saving compile time.

*Two-phase lookup:* names that don't depend on template parameters are looked up when the template is defined; dependent names, when it's instantiated. Consequences:

- A dependent qualified name that's a type needs `typename`: `typename T::value_type x;`.
- A dependent member template needs `template`: `t.template get<0>()`.
- Members inherited from a dependent base aren't found by unqualified lookup; write `this->member` or `Base<T>::member`.

### Variadic templates and folds

`template <class... Ts> void f(Ts... args)` takes a pack. `sizeof...(Ts)` counts it; a pattern followed by `...` expands it: `g(std::forward<Ts>(args)...)`. C++17 fold expressions replace recursion: `(args + ...)` (unary right), `(... + args)` (unary left), `(args + ... + 0)` (binary right). Empty unary folds are only allowed for `&&` (true), `||` (false) and `,` (void). C++26 adds pack indexing: `Ts...[0]`.

### CTAD

Class template argument deduction (C++17) lets `std::vector v{1, 2, 3};` deduce `std::vector<int>`. Deduction guides tell the compiler how to deduce from constructor arguments. Watch out for braces: `std::vector v2{v.begin(), v.end()}` is a vector of two iterators.
