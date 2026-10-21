### `new` is two steps

A `new T(args)` expression calls `operator new(sizeof(T))` to get raw memory, then constructs `T` in it. `delete p` runs the destructor, then calls `operator delete`. You can do each step yourself:

- **Placement new** `new (ptr) T(args)` constructs in memory you provide. You must later call `p->~T()` (or `std::destroy_at(p)`) yourself, and never `delete` it.
- `std::construct_at` and `std::destroy_at` (C++20) do the same and work in `constexpr`.
- You can replace global `operator new`/`delete` or provide class-specific versions, useful for counting allocations or pooling.
- Over-aligned types (`alignof(T) > alignof(std::max_align_t)`, typically 16) use the `std::align_val_t` overloads since C++17, so `new` respects `alignas(64)`.

Never mix families: `malloc` with `free`, `new` with `delete`, `new[]` with `delete[]`.

### Alignment and layout

Every type has an alignment requirement (`alignof`); its address must be a multiple of it. Accessing a misaligned object is UB, even though x86 and modern ARM usually tolerate misaligned plain loads (atomics and some SIMD instructions don't).

The compiler lays out members in declaration order, inserting padding so each member is aligned, and pads the end so the size is a multiple of the struct's alignment (so arrays work). Ordering members from largest to smallest alignment minimizes padding. `alignas(64)` on a type or member forces cache-line alignment; `offsetof` gives member offsets for standard-layout types.

Packed structs (`__attribute__((packed))`) remove padding to match wire formats, but taking a pointer or reference to a misaligned member and using it is UB. Copy fields out instead.

### Strict aliasing

You may access an object only through an lvalue of its own type (ignoring cv and signed/unsigned differences), or through `char`, `unsigned char` or `std::byte`. The compiler relies on this: it assumes an `int*` and a `float*` never point to the same object, so it can keep values in registers across stores. `*reinterpret_cast<std::uint32_t*>(&some_float)` is UB.

Correct ways to reinterpret bytes:

- `std::memcpy` into an object of the target type. Compilers turn small fixed-size `memcpy` into a single load or store, so it's free.
- `std::bit_cast<To>(from)` (C++20) for equally sized trivially copyable types; it's also `constexpr`.
- Union type punning (write one member, read another) is UB in C++ (unlike C). GCC and Clang document it as working, but it's non-portable.

### When does an object exist?

An object exists only if it was created by a definition, a `new` expression, a temporary, or a change of the active union member. Casting a pointer to a byte buffer doesn't create one. C++20 (P0593) added *implicit object creation*: `malloc`, `operator new`, `memcpy`, `memmove` and arrays of `unsigned char`/`std::byte` implicitly create objects of *implicit-lifetime types* (per \[class.prop\] and \[basic.types.general\]: scalar types, arrays, aggregates whose destructor isn't user-provided, and classes with at least one trivial eligible constructor plus a trivial, non-deleted destructor) when that makes the program's behavior defined. That retroactively blessed most C-style code.

For a received network buffer, the C++23 `std::start_lifetime_as<T>(p)` explicitly starts the lifetime of a `T` over existing bytes, keeping their values; it still requires correct alignment. Library support is still limited, so `memcpy` remains the portable choice.

`std::launder` produces a usable pointer to a new object created in storage that previously held an object you still have a pointer to, needed in rare cases such as when the old object had `const` or reference members. You'll mostly need it to answer interview questions.

### Bytes on the wire

- `std::endian::native` (C++20) tells you the platform's byte order; both your Mac and x86 are little-endian. `std::byteswap` (C++23) reverses bytes and compiles to one instruction (`bswap` on x86, `rev` on ARM).
- `std::aligned_storage` is deprecated in C++23; write `alignas(T) std::byte buf[sizeof(T)];`.
- Trivially copyable types (`std::is_trivially_copyable_v`) may be copied with `memcpy`. Polymorphic types and types with non-trivial copy operations may not.
