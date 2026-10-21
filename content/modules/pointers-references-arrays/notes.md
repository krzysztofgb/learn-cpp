### Pointers vs references

|  | Pointer `T*` | Reference `T&` |
| --- | --- | --- |
| Can be null | Yes | No (binding to `*nullptr` is UB) |
| Can be reseated | Yes | No; assignment writes through to the referent |
| Must be initialized | No | Yes |
| Arithmetic | Yes | No |
| Arrays of them | Yes | No: no arrays of references, no pointers to references, no references to references |

Use a reference when the thing must exist and the binding never changes. Use a pointer when null is meaningful or you need to reseat. For non-owning parameters, `const T&` is the default; a raw `T*` means "optional, non-owning".

### Reading declarations

Read right to left from the name. `const int* p` and `int const* p` are pointers to const `int` (you can't write `*p`, you can reseat `p`). `int* const p` is a const pointer to mutable `int`. `const int* const p` is both. Complex declarations are clearer with aliases: `using Handler = void (*)(int); Handler table[4];`.

### Arrays and decay

A built-in array `int a[10]` has type `int[10]`, and its size is part of the type. In almost every expression it *decays* to a pointer to its first element. It does not decay as the operand of `sizeof`, `&`, `decltype`, or when binding to a reference.

- A function parameter declared `int a[10]` is really `int* a`. Inside the function, `sizeof(a)` is the pointer size, and the 10 is ignored.
- To keep the size, take the array by reference: `template <class T, std::size_t N> void f(T (&a)[N])`. Or pass `std::span<T>`, or use `std::array<T, N>`, which never decays.
- `std::size(a)` works on arrays and containers; it won't compile on a decayed pointer, which is a feature.
- `a[i]` is defined as `*(a + i)`, so `i[a]` is legal and identical.
- Multidimensional arrays are arrays of arrays, stored row-major: `int m[2][3]` is two `int[3]` back to back, and `m` decays to `int (*)[3]`.

### Pointer arithmetic rules

Pointer arithmetic is only defined within a single array object, plus the one-past-the-end position. Forming `arr + 5` for a 4-element array is UB even if you never dereference it. Dereferencing one-past-the-end is UB. A non-array object counts as an array of one.

Subtracting pointers into different arrays is UB, and the result type of a valid subtraction is `std::ptrdiff_t`. Comparing unrelated pointers with `<` gives an unspecified result. `std::less<T*>` is guaranteed to give a strict total order, which is why ordered containers of pointers use it.

### String literals and null

A string literal like `"hi"` has type `const char[3]` (including the terminating zero) and static storage. Modifying one is UB. Whether two identical literals share storage is unspecified. `char* s = "hi";` has been ill-formed since C++11.

`nullptr` has type `std::nullptr_t` and converts only to pointer types. `NULL` is an implementation-defined null pointer constant (`0`, `0L` or the compiler builtin `__null`), so overloads on `int` and pointer behave differently with each. Always use `nullptr`.

### Function pointers and `void*`

A function name decays to a function pointer. `void*` holds any object pointer, but you can't do arithmetic on it or dereference it; convert back to the original type with `static_cast`. Converting a function pointer to `void*` is conditionally supported, not portable.
