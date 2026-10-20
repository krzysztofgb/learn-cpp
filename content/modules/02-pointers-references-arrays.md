# Module 2: Pointers, references and arrays

Go hides most of this: slices carry their length and there's no pointer arithmetic. C++ arrays lose their size the moment you pass them, and pointer arithmetic has sharp edges that interviewers probe.

## Notes

### 2.1 Pointers vs references

|  | Pointer `T*` | Reference `T&` |
| --- | --- | --- |
| Can be null | Yes | No (binding to `*nullptr` is UB) |
| Can be reseated | Yes | No; assignment writes through to the referent |
| Must be initialized | No | Yes |
| Arithmetic | Yes | No |
| Arrays of them | Yes | No: no arrays of references, no pointers to references, no references to references |

Use a reference when the thing must exist and the binding never changes. Use a pointer when null is meaningful or you need to reseat. For non-owning parameters, `const T&` is the default; a raw `T*` means "optional, non-owning".

### 2.2 Reading declarations

Read right to left from the name. `const int* p` and `int const* p` are pointers to const `int` (you can't write `*p`, you can reseat `p`). `int* const p` is a const pointer to mutable `int`. `const int* const p` is both. Complex declarations are clearer with aliases: `using Handler = void (*)(int); Handler table[4];`.

### 2.3 Arrays and decay

A built-in array `int a[10]` has type `int[10]`, and its size is part of the type. In almost every expression it *decays* to a pointer to its first element. It does not decay as the operand of `sizeof`, `&`, `decltype`, or when binding to a reference.

- A function parameter declared `int a[10]` is really `int* a`. Inside the function, `sizeof(a)` is the pointer size, and the 10 is ignored.
- To keep the size, take the array by reference: `template <class T, std::size_t N> void f(T (&a)[N])`. Or pass `std::span<T>`, or use `std::array<T, N>`, which never decays.
- `std::size(a)` works on arrays and containers; it won't compile on a decayed pointer, which is a feature.
- `a[i]` is defined as `*(a + i)`, so `i[a]` is legal and identical.
- Multidimensional arrays are arrays of arrays, stored row-major: `int m[2][3]` is two `int[3]` back to back, and `m` decays to `int (*)[3]`.

### 2.4 Pointer arithmetic rules

Pointer arithmetic is only defined within a single array object, plus the one-past-the-end position. Forming `arr + 5` for a 4-element array is UB even if you never dereference it. Dereferencing one-past-the-end is UB. A non-array object counts as an array of one.

Subtracting pointers into different arrays is UB, and the result type of a valid subtraction is `std::ptrdiff_t`. Comparing unrelated pointers with `<` gives an unspecified result. `std::less<T*>` is guaranteed to give a strict total order, which is why ordered containers of pointers use it.

### 2.5 String literals and null

A string literal like `"hi"` has type `const char[3]` (including the terminating zero) and static storage. Modifying one is UB. Whether two identical literals share storage is unspecified. `char* s = "hi";` has been ill-formed since C++11.

`nullptr` has type `std::nullptr_t` and converts only to pointer types. `NULL` is an implementation-defined null pointer constant (`0`, `0L` or the compiler builtin `__null`), so overloads on `int` and pointer behave differently with each. Always use `nullptr`.

### 2.6 Function pointers and `void*`

A function name decays to a function pointer. `void*` holds any object pointer, but you can't do arithmetic on it or dereference it; convert back to the original type with `static_cast`. Converting a function pointer to `void*` is conditionally supported, not portable.

## Predict the output

Assume headers, `main`, and `using std::cout;`. 64-bit macOS.

**P1**

```cpp kind=fragment run=local
int a[10];
cout << sizeof(a) << ' ' << std::size(a);
```

**P2**

```cpp kind=fragment run=local note="This only defines f; add int x[10]; f(x); to call it. In the browser this is wasm32, where `long` and pointers are 32-bit, so it prints 4 here."
void f(int a[10]) { cout << sizeof(a); }
// called as: int x[10]; f(x);
```

**P3**

```cpp kind=fragment run=local
int a[3] = {1, 2, 3};
cout << 2[a];
```

**P4**

```cpp kind=fragment run=local
const char* s1 = "hi";
const char* s2 = "hi";
cout << (s1 == s2);
```

**P5**

```cpp kind=fragment run=local note="wasi-libc defines NULL so that g(NULL) picks g(int) here. With Clang or GCC on macOS and Linux the call is ambiguous: try it in Compiler Explorer."
void g(int)   { cout << "int "; }
void g(char*) { cout << "ptr "; }
g(0); g(nullptr); g(NULL);
```

**P6**

```cpp kind=fragment run=local
int x = 1, y = 2;
int& r = x;
r = y;
y = 3;
cout << x;
```

**P7**

```cpp kind=fragment run=local
int m[2][3];
cout << sizeof(m) << ' ' << sizeof(m[0]) << ' ' << sizeof(m[0][0]);
```

**P8**

```cpp kind=fragment run=local
int a[5]{};
int* p = a;
cout << (&a[4] - p) << ' '
     << std::is_same_v<decltype(&a), int (*)[5]> << ' '
     << std::is_same_v<decltype(p + 1), int*>;
```

## Spot the UB

**U1**

```cpp kind=fragment run=local
int* p = nullptr;
int& r = *p;
```

**U2**

```cpp kind=fragment run=local
char* s = const_cast<char*>("hello");
s[0] = 'H';
```

**U3**

```cpp kind=fragment run=local
int* make() {
    int x = 42;
    return &x;
}
```

**U4**

```cpp kind=fragment run=local
int a[3], b[3];
bool before = &a[0] < &b[0];
auto dist = &b[0] - &a[0];
```

**U5**

```cpp kind=fragment run=local
int a[4];
for (int i = 0; i <= 4; ++i) a[i] = i;
```

**U6**

```cpp kind=fragment run=local
int* p = new int[10];
delete p;
```

**U7**

```cpp kind=fragment run=local
std::vector<int> v{1, 2, 3};
int& first = v[0];
v.push_back(4);
first = 10;
```

## Exercises

**E1 ★ `array_size`.** Write `template <class T, std::size_t N> constexpr std::size_t array_size(T (&)[N]) noexcept`. Show that it rejects a pointer at compile time while `sizeof(a) / sizeof(a[0])` silently gives a wrong answer.

**E2 ★ Declaration drills.** Write, without aliases, then with `using`: a pointer to an array of 5 `int`; an array of 5 pointers to `int`; a pointer to a function taking `int` and returning a pointer to `char`; an array of 3 such function pointers. Check each with `static_assert` and `std::is_same_v`.

**E3 ★★ `memcpy` and `memmove`.** Implement `my_memcpy` and `my_memmove` over `unsigned char`. `my_memmove` must handle overlap in both directions. Comparing the two pointers with `<` is unspecified for unrelated buffers, so use `std::less` or compare `std::uintptr_t` values, and explain why.

**E4 ★★ Row-major matrix.** Implement `Matrix` storing `rows * cols` doubles in one `std::vector`, with `operator()(r, c)`. Time row-order vs column-order traversal of a 4096×4096 matrix and explain the gap (Module 21 explains it fully).

**E5 ★★★ `ArrayView<T>`.** Implement a non-owning view like `std::span<T>`: constructible from a C array, `std::array` and `std::vector`, with `size`, unchecked `operator[]`, bounds-checked `at`, `subview(offset, count)`, and iterators. Make the C-array constructor deduce `N`. Write tests that catch an out-of-range `subview` under ASan.

## Interview questions

1. What are the differences between a pointer and a reference? When do you use each?
2. What is array decay, and how do you pass an array to a function without losing its size?
3. Explain `const int*`, `int* const` and `const int* const`.
4. Why use `nullptr` instead of `NULL` or `0`?
5. Is `a[i]` the same as `*(a + i)`? What does that imply about `i[a]`?
6. Can you have an array of references? A pointer to a reference? A reference to a pointer?
7. Why does `std::set<T*>` use `std::less` instead of the raw `<` operator?
8. What is the one-past-the-end pointer, and why is forming it allowed but forming two-past-the-end is not?
9. What's the type of a string literal, and why can't you modify it?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `40 10` | `sizeof` on an array is the whole array: 10 × 4 bytes. |
| P2 | `8` | The parameter is really `int*`. Clang warns with `-Wsizeof-array-argument`. |
| P3 | `3` | `2[a]` is `*(2 + a)`, the same as `a[2]`. |
| P4 | Unspecified | Identical literals may or may not share storage. In practice usually `1`, because compilers merge them. |
| P5 | ` int ptr  ` then a compile error | `g(NULL)` is ambiguous on both GCC and Clang (verified): their `NULL` is the builtin `__null`, which converts to `int` and to `char*` equally well. On an implementation defining `NULL` as plain `0`, it would pick `int`. Either way, `nullptr` avoids the question. |
| P6 | `2` | `r = y` assigns 2 to `x`; references never reseat. Changing `y` afterwards doesn't affect `x`. |
| P7 | `24 12 4` | Two rows of three `int`s, one row, one `int`. |
| P8 | `4 1 1` | Pointer difference counts elements. `&a` is a pointer to the whole array. |

### Spot the UB

- **U1:** UB. Dereferencing a null pointer, even just to bind a reference, is undefined.
- **U2:** UB. String literals are immutable; casting away `const` doesn't change that. Use `char s[] = "hello";` for a mutable copy.
- **U3:** Returning the pointer is legal; using it is UB because `x` is dead. Compilers warn with `-Wreturn-stack-address`.
- **U4:** `<` on unrelated pointers is unspecified, not UB. The subtraction is UB because the pointers belong to different arrays.
- **U5:** UB on the last iteration: writing `a[4]` is out of bounds.
- **U6:** UB. Memory from `new[]` must be released with `delete[]`.
- **U7:** UB if `push_back` reallocates, which it does here since capacity was 3. `first` dangles.

### Exercise hints

- **E3:** If the destination starts after the source and the ranges overlap, copy backwards. `std::less<>{}(dst, src)` is guaranteed to be consistent even for unrelated pointers.
- **E5:** Deduce `N` with a constructor template `template <std::size_t N> ArrayView(T (&a)[N])`. Use `assert` in `subview` and let ASan catch the rest.

### Interview questions

1. See table 2.1. A reference is an alias that must be bound at initialization and can't be null or reseated; a pointer is an object holding an address. Use references for required parameters, pointers for optional or reseatable ones.
2. In most expressions an array converts to a pointer to its first element and loses its size. Pass by reference to array (`T (&)[N]` in a template), use `std::span`, or use `std::array`.
3. Pointer to const `int`; const pointer to mutable `int`; const pointer to const `int`. Read right to left.
4. `nullptr` has its own type and only converts to pointers, so overload resolution and templates behave predictably. `NULL` is an integer constant in disguise.
5. Yes, by definition. Since addition commutes, `i[a]` is `*(i + a)`, which is legal but only good for trivia.
6. No, no, and yes: `int*& r = p;` is a reference to a pointer.
7. `<` between pointers into different objects gives unspecified results. `std::less<T*>` is required to give a strict total order consistent across all pointers.
8. It's the end iterator of a range, so algorithms need to form it. The standard allows forming it but not dereferencing it. Anything beyond is UB to form, partly because on segmented architectures the address might not be representable.
9. `const char[N]`, including the terminating zero, with static storage. It may live in read-only memory and may be shared with identical literals, so writes are UB.
