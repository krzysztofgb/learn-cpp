# Module 8: Value categories and move semantics

Move semantics let C++ transfer ownership of resources instead of copying them. Interviewers test whether you know that `std::move` moves nothing, that a named rvalue reference is an lvalue, and when copies are elided entirely.

## Notes

### 8.1 Value categories

Every expression has a type and a value category.

| Category | Has identity? | Can be moved from? | Examples |
| --- | --- | --- | --- |
| lvalue | Yes | Not implicitly | Variable names (even of type `T&&`), `*p`, `a[i]`, `++i`, a call returning `T&`, string literals |
| xvalue | Yes | Yes | `std::move(x)`, a call returning `T&&`, a member of an rvalue (`make().member`) |
| prvalue | No | Initializes an object directly | `42`, `a + b`, `i++`, a call returning `T` by value, a lambda expression, `this` |

*glvalue* = lvalue or xvalue (has identity). *rvalue* = xvalue or prvalue (can be moved from). `decltype((expr))` reveals the category: `T&` for lvalues, `T&&` for xvalues, plain `T` for prvalues.

### 8.2 Moves

A move constructor `T(T&&) noexcept` steals the source's resources and leaves it in a *valid but unspecified* state: you can destroy it or assign to it, and call member functions without preconditions (like `size()` or `clear()`), but you can't assume its contents. Some types specify more: a moved-from `unique_ptr` is null.

`std::move(x)` is only `static_cast<std::remove_reference_t<decltype(x)>&&>(x)`. It enables a move; the move happens only if some overload taking `T&&` is selected. Moving a `const` object silently copies, because `const T&&` doesn't bind to `T&&` but does bind to `const T&`.

### 8.3 Forwarding references and `std::forward`

In `template <class T> void f(T&& x)` and in `auto&& x`, `T&&` is a *forwarding reference*, not an rvalue reference: if you pass an lvalue `int`, `T` deduces to `int&`, and reference collapsing turns `int& &&` into `int&`. The collapsing rule: any `&` wins; only `&& &&` gives `&&`.

Inside `f`, `x` has a name, so it's an lvalue. `std::forward<T>(x)` casts it back to an rvalue only if an rvalue was passed. Forward each argument at most once; after forwarding, treat it as possibly moved-from.

`T&&` is a forwarding reference only when `T` is deduced at that call. `std::vector<T>&&` and `const T&&` are plain rvalue references.

### 8.4 Copy elision

- **Guaranteed (C++17):** a prvalue initializes its destination directly. `T x = T();`, `T x = make();` (where `make` returns a prvalue), and `return T{...};` never call a copy or move constructor, which may even be deleted.
- **NRVO (optional):** `T f() { T local; ...; return local; }` usually constructs `local` directly in the caller's storage. Clang and GCC do this when every return returns the same variable.
- **Implicit move:** when NRVO doesn't apply, `return local;` still treats `local` as an rvalue (and C++20/C++23 widened the cases). So `return std::move(local);` is a *pessimization*: it turns a prvalue-like return into an xvalue, disabling NRVO. Clang warns with `-Wpessimizing-move`.

### 8.5 Parameter passing

| Intent | Signature |
| --- | --- |
| Read only, cheap to copy (`int`, `string_view`, small structs) | `T` |
| Read only, expensive | `const T&` |
| Modify | `T&` |
| Take ownership / store a copy | `T` by value, then `std::move` into place (one extra move vs two overloads) |
| Generic forwarding | `T&&` + `std::forward` |

Ref-qualified member functions (`auto data() &&`) let a member behave differently on rvalue objects, for example moving out of a temporary.

## Predict the output

**P1**

```cpp kind=fragment run=local
void f(int&)  { cout << 'L'; }
void f(int&&) { cout << 'R'; }
int x = 1;
int&& r = 2;
f(x); f(1); f(std::move(x)); f(r);
```

**P2**

```cpp kind=fragment run=local
struct S {
    S() = default;
    S(const S&) { cout << 'C'; }
    S(S&&)      { cout << 'M'; }
};
const S a;
S b = std::move(a);
```

**P3** (`S` as in P2, plus `S() { cout << 'D'; }`)

```cpp kind=fragment run=none
S make() { return S{}; }
S s = make();
```

**P4** (same `S`)

```cpp kind=fragment run=none
S g() { S local; return std::move(local); }
S h() { S local; return local; }
g(); cout << '|'; h();
```

**P5** (`f` from P1)

```cpp kind=fragment run=none
template <class T> void wrap(T&& t) {
    f(t);
    f(std::forward<T>(t));
}
int x = 1;
wrap(x); wrap(1);
```

**P6**

```cpp kind=fragment run=local
std::string a = "a string too long for the small-string buffer";
std::string b = std::move(a);
cout << a.size();
```

## Spot the bug or UB

**U1**

```cpp kind=fragment run=local
std::vector<int> v{1, 2, 3};
std::vector<int> w = std::move(v);
std::cout << v[0];
```

**U2**

```cpp kind=fragment run=local
std::string&& make_name() {
    std::string s = "AAPL";
    return std::move(s);
}
```

**U3**

```cpp kind=fragment run=none
template <class T>
void log_and_store(T&& x) {
    store_.push_back(std::forward<T>(x));
    logger_.write(std::forward<T>(x));
}
```

**U4**

```cpp kind=fragment run=none
std::vector<int> get_levels();
auto&& first = get_levels()[0];
std::cout << first;
```

**U5**

```cpp kind=fragment run=none
Buffer& Buffer::operator=(Buffer&& o) noexcept {
    delete[] data_;
    data_ = o.data_;
    size_ = o.size_;
    o.data_ = nullptr;
    return *this;
}
// later: buf = std::move(buf);
```

## Exercises

**E1 ★ Category probe.** Write `template <class T> constexpr const char* category = "prvalue";` with specializations for `T&` (lvalue) and `T&&` (xvalue), and a macro `CAT(e)` using `category<decltype((e))>`. Classify 15 expressions, including `x`, `std::move(x)`, `x++`, `++x`, `"lit"`, `make().member`, `arr[0]`, a ternary of two lvalues, and a ternary of an lvalue and a prvalue.

**E2 ★★ Movable `Buffer`.** Implement a heap-backed `Buffer` with copy and move operations. Verify `std::is_nothrow_move_constructible_v`, then count copies during `std::vector<Buffer>` growth with and without `noexcept`.

**E3 ★★ `my_make_unique`.** Implement `template <class T, class... Args> std::unique_ptr<T> my_make_unique(Args&&... args)` with perfect forwarding. Test with a type whose constructor has separate `const std::string&` and `std::string&&` overloads that print which one ran.

**E4 ★★ Sink parameters.** For a `setName` member, implement (a) `const std::string&` only, (b) by-value plus `std::move`, (c) `const&` and `&&` overloads. Count allocations with a replaced global `operator new` for lvalue, rvalue and string-literal arguments, and fill in a table.

**E5 ★★★ Implement `move` and `forward`.** Write `my_move` and `my_forward` (both overloads of `forward`). Explain why `forward` requires an explicit template argument, and add `static_assert` tests for each combination of argument category and `T`.

## Interview questions

1. Define lvalue, prvalue and xvalue, with an example of each.
2. What does `std::move` do? Does it move anything?
3. What state is an object in after being moved from?
4. What's the difference between an rvalue reference and a forwarding reference?
5. Explain reference collapsing.
6. What is guaranteed copy elision? How is it different from NRVO?
7. Why is `return std::move(local);` usually wrong?
8. Why should move constructors be `noexcept`?
9. When should a function take a parameter by value?
10. Can you move from a `const` object?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `LRRL` | `r` has type `int&&` but, being a named variable, is an lvalue. |
| P2 | `C` | `std::move(a)` is `const S&&`, which binds only to the copy constructor. |
| P3 | `D` | Guaranteed elision: one construction directly into `s`. |
| P4 | `DM\|D` | `std::move` defeats NRVO in `g`. In `h`, Clang and GCC apply NRVO (not guaranteed; without it you'd see an implicit move). |
| P5 | `LLLR` | `t` is always an lvalue; `forward` restores the original category. |
| P6 | Unspecified (`0` in practice) | Valid but unspecified state. libc++ and libstdc++ both leave it empty. |

### Spot the bug or UB

- **U1:** `v` is valid but unspecified; in practice empty, so `v[0]` is out of bounds: UB. Only call operations without preconditions on moved-from objects, or reassign first.
- **U2:** Returns a reference to a local that's destroyed on return: dangling, UB on use. Return `std::string` by value.
- **U3:** If `x` was an rvalue, the first `forward` may move it into `store_`, and the logger sees a moved-from value. Forward only on the last use.
- **U4:** `operator[]` returns a reference into the temporary vector, which dies at the end of the statement. `first` dangles. Bind the vector to a variable first.
- **U5:** Self-move-assignment deletes the buffer, then keeps a pointer to it and nulls it: data loss and a dangling pointer in the general case. Guard with `if (this != &o)` or use move-and-swap.

### Exercise hints

- **E1:** A ternary of two lvalues of the same type is an lvalue; with a prvalue operand it's a prvalue. `x++` is a prvalue; `++x` is an lvalue.
- **E4:** By-value plus move: lvalue = 1 copy, rvalue = 0 copies (2 moves total), literal = 1 construction. Overloads save one move per call; by-value saves code.
- **E5:** `forward` must know the original type, which can't be deduced from the now-lvalue argument. Hence `std::forward<T>(x)`.

### Interview questions

1. lvalue: has identity, e.g. `x`. xvalue: has identity but is expiring, e.g. `std::move(x)`. prvalue: no identity, initializes an object, e.g. `x + 1`.
2. It's an unconditional cast to an rvalue reference. Nothing moves until a move constructor or move assignment is selected.
3. Valid but unspecified unless the type documents more. You can destroy it, assign to it, and call members without preconditions.
4. `T&&` with `T` deduced (or `auto&&`) binds to anything and preserves the category through deduction; otherwise `T&&` binds only to rvalues.
5. When references to references form via templates or aliases: `& &`, `& &&` and `&& &` collapse to `&`; `&& &&` collapses to `&&`.
6. Since C++17, prvalues initialize their destination directly, with no copy or move constructor needed. NRVO is an optional optimization for named locals.
7. It turns the return into an xvalue, preventing NRVO; the plain `return local;` already moves implicitly when NRVO doesn't apply.
8. Containers use moves during reallocation only if they can't throw; otherwise they copy to keep the strong guarantee.
9. When the function stores or consumes its own copy anyway: callers with rvalues pay a move instead of a copy.
10. No. `std::move` of a `const` object yields `const T&&`, which selects the copy constructor.
