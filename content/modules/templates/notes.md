### Kinds of templates

Function templates, class templates, alias templates (`template <class T> using Vec = std::vector<T, MyAlloc<T>>;`), and variable templates (`template <class T> constexpr bool is_small_v = sizeof(T) <= 16;`). C++20 abbreviated syntax: `void log(const auto& x)` is a function template.

A template isn't code until it's instantiated: each distinct set of template arguments produces its own function or class, compiled and optimized separately (monomorphization). Calls are direct and inlinable, and each instantiation is type-checked when it's created; the cost is a larger binary and longer builds. Code that must not be duplicated per type can sit behind a non-template function or a type-erased interface (`std::function`, virtual functions), which trades the inlining away for one shared copy.

> **Coming from Go?** Go type-checks a generic function once against its constraints and, in the current compiler, generates one copy per *GC shape* (all pointer types share one) that receives a dictionary of type information at run time. C++ always generates one copy per type argument, which is why C++ generics inline fully and Go's often don't.

*Further reading:* [Function templates](https://www.learncpp.com/cpp-tutorial/function-templates/), [Function template instantiation](https://www.learncpp.com/cpp-tutorial/function-template-instantiation/), [Class templates](https://www.learncpp.com/cpp-tutorial/class-templates/), [Alias templates](https://www.learncpp.com/cpp-tutorial/alias-templates/)

### Argument deduction

| Parameter | Argument `const int[3]` lvalue | Argument `int` lvalue | Argument `int` rvalue |
| --- | --- | --- | --- |
| `T` (by value) | `T = const int*` (decays, drops top-level const) | `int` | `int` |
| `T&` | `T = const int[3]` | `int` | Doesn't bind |
| `const T&` | `T = int[3]` | `int` | `int` |
| `T&&` (forwarding) | `T = const int(&)[3]` | `int&` | `int` |

Deduction doesn't consider implicit conversions: `template <class T> T max(T, T); max(1, 2.0);` fails because `T` can't be both `int` and `double`. Fix with explicit arguments (`max<double>(1, 2.0)`) or two type parameters. With two type parameters the result type is usually `std::common_type_t<A, B>`, the type the usual arithmetic conversions would give `a + b` for arithmetic types (:sec[types-and-initialization/the-usual-arithmetic-conversions]). That includes the signed/unsigned trap: the common type of `int` and `unsigned` is `unsigned`, so `-1` becomes a huge value. Compare mixed-sign integers with `std::cmp_less` and friends (C++20).

A template taking `const T&` has the same lifetime traps as any function: an argument like `0` or `100` creates a temporary that lives only until the end of the full-expression containing the call, and returning a reference to a parameter doesn't extend it (:sec[object-lifetime/temporaries-and-lifetime-extension]).

*Further reading:* [Function templates with multiple template types](https://www.learncpp.com/cpp-tutorial/function-templates-with-multiple-template-types/), [Type deduction with pointers, references, and const](https://www.learncpp.com/cpp-tutorial/type-deduction-with-pointers-references-and-const/)

### Template parameters

- Type parameters (`class T` / `typename T`).
- Non-type template parameters (NTTPs): integers, enums, pointers, and since C++20 floating-point values and *structural* class types. A class is structural when it's a literal type whose bases and non-static data members are all public, not `mutable`, and themselves structural (scalars, lvalue references, arrays of those, or structural classes). Two such arguments are the same template argument when their members are equal, member by member. This enables string literals as template arguments via a `FixedString` type, and a class template can be the NTTP's type, deduced from the argument like CTAD:

```cpp kind=fragment
template <std::size_t N>
struct FixedString {
    char s[N]{};
    constexpr FixedString(const char (&str)[N]) { std::copy_n(str, N, s); }
};
template <FixedString Name> struct Field { static constexpr auto name = Name; };

cout << Field<"price">::name.s;   // FixedString<6> deduced from "price"
```

- Template template parameters: `template <template <class> class Container>`.
- Defaults are allowed for all of them.

*Further reading:* [Non-type template parameters](https://www.learncpp.com/cpp-tutorial/non-type-template-parameters/), [Template non-type parameters](https://www.learncpp.com/cpp-tutorial/template-non-type-parameters/)

### Specialization

- **Full specialization:** `template <> struct Hash<Price> { ... };`.
- **Partial specialization** (class and variable templates only): `template <class T> struct IsPointer<T*> : std::true_type {};`. Partial specializations also pattern-match packs, which is how compile-time type lists are taken apart: `template <class T, class... Rest> struct Front<TypeList<T, Rest...>> { using type = T; };`.
- Function templates can't be partially specialized, and full specializations don't participate in overload resolution: the compiler first chooses among *primary templates* and non-template overloads, then checks for a specialization of the winner. Prefer overloading functions to specializing them; when you need partial specialization for a function, forward to a static member of a class template, which can be partially specialized.
- An explicit specialization of a function template belongs to one primary template, fixed where the specialization is declared: the most specialized of the primaries declared *before* it whose signature it matches. A primary declared later can't acquire it, so the same three declarations in a different order can call different functions.
- A specialization must be declared before any use that would instantiate the primary, in every translation unit that uses it; otherwise the program is ill-formed, no diagnostic required. In practice: declare specializations in the same header as the primary template.

*Further reading:* [Function template specialization](https://www.learncpp.com/cpp-tutorial/function-template-specialization/), [Class template specialization](https://www.learncpp.com/cpp-tutorial/class-template-specialization/), [Partial template specialization](https://www.learncpp.com/cpp-tutorial/partial-template-specialization/)

### Instantiation and lookup

Templates are instantiated in each TU that uses them (implicitly inline for ODR purposes). The compiler needs the full definition at the point of instantiation, which is why templates usually live in headers. `template class Ring<int>;` explicitly instantiates; `extern template class Ring<int>;` tells other TUs not to, saving compile time, and with explicit instantiations for a fixed set of types the definitions can move to a `.cpp` file.

*Two-phase lookup:* names that don't depend on template parameters are looked up when the template is defined; dependent names, when it's instantiated. Consequences:

- A dependent qualified name that's a type needs `typename`: `typename T::value_type x;`. Without it, the compiler assumes `T::value_type` names a value, so the declaration doesn't parse.
- A dependent member template needs `template`: `t.template get<0>()`.
- Members inherited from a dependent base aren't found by unqualified lookup, because the base isn't known until instantiation; write `this->member` or `Base<T>::member`.

Controlling code size and build time: move code that doesn't depend on `T` into non-template helpers, type-erase at module boundaries, use `extern template` with one explicit instantiation, keep heavy headers out of widely included ones, and use C++20 modules where your toolchain supports them.

*Further reading:* [Using function templates in multiple files](https://www.learncpp.com/cpp-tutorial/using-function-templates-in-multiple-files/), [Class templates with member functions](https://www.learncpp.com/cpp-tutorial/class-templates-with-member-functions/)

### Variadic templates and folds

`template <class... Ts> void f(Ts... args)` takes a pack. `sizeof...(Ts)` counts it (zero for an empty pack); a pattern followed by `...` expands it: `g(std::forward<Ts>(args)...)`. C++17 fold expressions replace recursion. For a pack E₁ … Eₙ and operator `op`:

| Fold | Expands to |
| --- | --- |
| `(E op ...)` unary right | E₁ op (… op (Eₙ₋₁ op Eₙ)) |
| `(... op E)` unary left | ((E₁ op E₂) op …) op Eₙ |
| `(E op ... op I)` binary right | E₁ op (… op (Eₙ op I)) |
| `(I op ... op E)` binary left | ((I op E₁) op …) op Eₙ |

The direction matters only for non-associative operators like `-`. Empty unary folds are only allowed for `&&` (true), `||` (false) and `,` (`void()`); a binary fold's init value `I` covers the empty case for any operator. A fold over the comma operator runs a statement once per element, left to right: `((std::cout << args << ' '), ...);`. Folds over `||` and `&&` short-circuit, so `(std::is_same_v<T, Ts> || ...)` asks whether a pack contains `T`. C++26 adds pack indexing: `Ts...[0]`.

### CTAD

Class template argument deduction (C++17) lets `std::vector v{1, 2, 3};` deduce `std::vector<int>`. The compiler deduces from the constructors as if each were a function template, plus any *deduction guides*, which map constructor argument types to template arguments explicitly:

```cpp kind=fragment run=none
template <class It>
Buffer(It, It) -> Buffer<typename std::iterator_traits<It>::value_type>;
```

Watch out for braces: list-initialization prefers an `initializer_list` constructor during CTAD as well, so `std::vector v2{v.begin(), v.end()}` is a vector of two iterators; parentheses pick the iterator-pair constructor.

*Further reading:* [Class template argument deduction (CTAD) and deduction guides](https://www.learncpp.com/cpp-tutorial/class-template-argument-deduction-ctad-and-deduction-guides/)
