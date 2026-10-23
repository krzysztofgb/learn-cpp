### Pointers vs references

|  | Pointer `T*` | Reference `T&` |
| --- | --- | --- |
| Can be null | Yes | No (binding to `*nullptr` is UB) |
| Can be reseated | Yes | No; assignment writes through to the referent |
| Must be initialized | No | Yes |
| Arithmetic | Yes | No |
| Arrays of them | Yes | No: no arrays of references, no pointers to references, no references to references |

Use a reference when the thing must exist and the binding never changes. Use a pointer when null is meaningful or you need to reseat. For non-owning parameters, `const T&` is the default; a raw `T*` means "optional, non-owning". A reference to a pointer (`int*& r = p;`) is fine, because a pointer is an object; a reference is not an object, which is why the table's last row rules out arrays of, pointers to and references to references.

Neither a pointer nor a reference keeps its target alive. Returning the address of a local, or a reference to one, compiles (compilers warn: `-Wreturn-stack-address` in Clang, `-Wreturn-local-addr` in GCC) and hands back a dangling pointer: using it is UB because the local's lifetime ended (:mod[object-lifetime]). The same goes for pointers, references and iterators into a container that reallocates: when a `std::vector` grows past its capacity, `push_back` moves the elements to new storage, and every earlier `&v[i]` dangles (:mod[containers]).

*Further reading:* [Lvalue references](https://www.learncpp.com/cpp-tutorial/lvalue-references/), [Introduction to pointers](https://www.learncpp.com/cpp-tutorial/introduction-to-pointers/), [Pass by address](https://www.learncpp.com/cpp-tutorial/pass-by-address/), [Return by reference and return by address](https://www.learncpp.com/cpp-tutorial/return-by-reference-and-return-by-address/)

### Reading declarations

Read right to left from the name. `const int* p` and `int const* p` are pointers to const `int` (you can't write `*p`, you can reseat `p`). `int* const p` is a const pointer to mutable `int`. `const int* const p` is both. Declarator operators bind as in expressions: postfix `[]` and `()` bind tighter than prefix `*`, so parentheses are needed to make the `*` apply first. `int* p[5]` is an array of 5 pointers to `int`; `int (*p)[5]` is a pointer to an array of 5 `int`; `char* (*f)(int)` is a pointer to a function taking `int` and returning `char*`; `char* (*fs[3])(int)` is an array of 3 of those. Complex declarations are clearer with aliases: `using Handler = void (*)(int); Handler table[4];`.

*Further reading:* [Pointers and const](https://www.learncpp.com/cpp-tutorial/pointers-and-const/), [Typedefs and type aliases](https://www.learncpp.com/cpp-tutorial/typedefs-and-type-aliases/)

### Arrays and decay

A built-in array `int a[10]` has type `int[10]`, and its size is part of the type. In almost every expression it *decays* to a pointer to its first element. It does not decay as the operand of `sizeof`, `&`, `decltype`, or when binding to a reference.

- A function parameter declared `int a[10]` is really `int* a`. Inside the function, `sizeof(a)` is the pointer size, and the 10 is ignored.
- To keep the size, take the array by reference: `template <class T, std::size_t N> void f(T (&a)[N])`. Or pass `std::span<T>`, or use `std::array<T, N>`, which never decays.
- `std::size(a)` works on arrays and containers; it won't compile on a decayed pointer, which is a feature.
- `a[i]` is defined as `*(a + i)`, so `i[a]` is legal and identical.
- `&a` doesn't decay: for `int a[5]` it has type `int (*)[5]`, a pointer to the whole array. It holds the same address as `&a[0]`, but `&a + 1` advances by the whole array (20 bytes), not by one `int`.
- Multidimensional arrays are arrays of arrays, stored row-major: `int m[2][3]` is two `int[3]` back to back, and `m` decays to `int (*)[3]`. `sizeof(m)` is the whole array, `sizeof(m[0])` one row.
- `char s[] = "hello";` copies the literal into a mutable array of 6 `char` (see below for the literal itself).
- An array allocated with `new T[n]` must be released with `delete[]`, and a single object from `new T` with `delete`. Mixing them is UB (\[expr.delete\]): `delete[]` has to know how many destructors to run and where the allocation really starts. Prefer `std::vector` or `std::unique_ptr<T[]>`.

> **Coming from Go?** A Go slice carries its pointer, length and capacity, and Go has no pointer arithmetic. A C++ array decays to a bare pointer with no length; `std::span` is the closest equivalent of a slice (pointer plus length, no capacity, no ownership).

*Further reading:* [Introduction to C-style arrays](https://www.learncpp.com/cpp-tutorial/introduction-to-c-style-arrays/), [C-style array decay](https://www.learncpp.com/cpp-tutorial/c-style-array-decay/), [Multidimensional C-style Arrays](https://www.learncpp.com/cpp-tutorial/multidimensional-c-style-arrays/), [Dynamically allocating arrays](https://www.learncpp.com/cpp-tutorial/dynamically-allocating-arrays/)

### Pointer arithmetic rules

Pointer arithmetic is only defined within a single array object, plus the one-past-the-end position (\[expr.add\]). Forming `arr + 5` for a 4-element array is UB even if you never dereference it. Dereferencing one-past-the-end is UB, and so is any out-of-bounds subscript such as `a[4]` for `int a[4]`. A non-array object counts as an array of one. One-past-the-end is allowed because it's the end of every half-open range `[first, last)`; nothing further is guaranteed to be representable (on segmented or tagged-pointer hardware it might not be).

Subtracting pointers into different arrays is UB, and the result type of a valid subtraction is `std::ptrdiff_t`. Comparing unrelated pointers with `<` gives an unspecified result. `std::less<T*>` (and `std::less<>`) is guaranteed to give a strict total order consistent with `<` where `<` is defined, which is why `std::set<T*>` and other ordered containers of pointers use it. Converting pointers to `std::uintptr_t` and comparing the integers also works on every mainstream flat-address platform, but the mapping is implementation-defined.

Any object's bytes can be read and written through `unsigned char*`, `char*` or `std::byte*`, which is how `memcpy` is implemented. `std::memcpy` requires the source and destination not to overlap (overlap is UB); `std::memmove` handles overlap by copying in whichever direction doesn't overwrite unread source bytes.

*Further reading:* [Pointer arithmetic and subscripting](https://www.learncpp.com/cpp-tutorial/pointer-arithmetic-and-subscripting/)

### String literals and null

A string literal like `"hi"` has type `const char[3]` (including the terminating zero) and static storage. Modifying one is UB. Whether two identical literals share storage is unspecified. `char* s = "hi";` has been ill-formed since C++11, and casting the `const` away with `const_cast` compiles but doesn't make writes legal.

`nullptr` has type `std::nullptr_t` and converts only to pointer types. `NULL` is an implementation-defined null pointer constant (`0`, `0L` or the compiler builtin `__null`), so overloads on `int` and pointer behave differently with each. The literal `0` is an `int`: given `g(int)` and `g(char*)`, `g(0)` is an exact match for `g(int)` and only a conversion for the pointer, so it picks `g(int)`. GCC and Clang define `NULL` as `__null`, which converts equally well to `int` and to `char*`, so `g(NULL)` is ambiguous there. `nullptr` matches only the pointer overload. Always use `nullptr`.

*Further reading:* [C-style strings](https://www.learncpp.com/cpp-tutorial/c-style-strings/), [Null pointers](https://www.learncpp.com/cpp-tutorial/null-pointers/)

### Function pointers and `void*`

A function name decays to a function pointer. `void*` holds any object pointer, but you can't do arithmetic on it or dereference it; convert back to the original type with `static_cast`. Converting a function pointer to `void*` is conditionally supported, not portable.

*Further reading:* [Function Pointers](https://www.learncpp.com/cpp-tutorial/function-pointers/), [Void pointers](https://www.learncpp.com/cpp-tutorial/void-pointers/)
