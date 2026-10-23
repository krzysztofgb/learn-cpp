### `new` is two steps

A `new T(args)` expression calls `operator new(sizeof(T))` to get raw memory, then constructs `T` in it. `delete p` runs the destructor, then calls `operator delete`. You can do each step yourself:

- `operator new` only allocates bytes. Unlike `malloc`, which returns null on failure, it throws `std::bad_alloc` (the `std::nothrow` overload returns null instead). Neither constructs anything.
- **Placement new** `new (ptr) T(args)` constructs in memory you provide. You must later call `p->~T()` (or `std::destroy_at(p)`) yourself, and never `delete` it.
- `std::construct_at` and `std::destroy_at` (C++20) do the same and work in `constexpr`.
- You can replace global `operator new`/`delete` or provide class-specific versions, useful for counting allocations or pooling.
- Over-aligned types (`alignof(T) > alignof(std::max_align_t)`, typically 16) use the `std::align_val_t` overloads since C++17, so `new` respects `alignas(64)`.

Never mix families: `malloc` with `free`, `new` with `delete`, `new[]` with `delete[]`.

Calling a destructor ends the object's lifetime \[basic.life\]. Destroying the same object again is UB, and that includes the implicit destructor call at the end of an automatic variable's scope, unless a new object of the same type was constructed in that storage in between. The reverse is allowed: you may reuse or release an object's storage without calling its destructor. That isn't UB in itself, but the destructor's side effects (freeing memory, printing, unlocking) simply don't happen, and a program that depends on them has UB.

Storage that holds no live object is just bytes, so a pool can thread its free list through its unused slots: each free slot's bytes hold a pointer to the next free slot, and no extra memory is needed. To make AddressSanitizer catch use of a released slot, mark it with `ASAN_POISON_MEMORY_REGION(addr, size)` on release and `ASAN_UNPOISON_MEMORY_REGION` on reuse, from `<sanitizer/asan_interface.h>`; the macros compile to nothing in builds without ASan.

*Further reading:* [Dynamic memory allocation with new and delete](https://www.learncpp.com/cpp-tutorial/dynamic-memory-allocation-with-new-and-delete/), [Dynamically allocating arrays](https://www.learncpp.com/cpp-tutorial/dynamically-allocating-arrays/), [new expression](https://en.cppreference.com/w/cpp/language/new)

### Alignment and layout

Every type has an alignment requirement (`alignof`); its address must be a multiple of it. Accessing a misaligned object is UB, even though x86 and modern ARM usually tolerate misaligned plain loads (atomics and some SIMD instructions don't).

The compiler lays out members in declaration order, inserting padding so each member is aligned, and pads the end so the size is a multiple of the struct's alignment (so arrays work). A struct's alignment is the largest of its members' alignments. Ordering members from largest to smallest alignment minimizes padding; GCC and Clang's `-Wpadded` (MSVC: warning C4820) reports every place padding is inserted. `alignas(64)` on a type or member forces cache-line alignment; `offsetof` gives member offsets for standard-layout types.

Packed structs (`__attribute__((packed))` on GCC and Clang, `#pragma pack(1)` on all three major compilers) remove padding to match wire formats, but taking a pointer or reference to a misaligned member and using it is UB. Copy fields out instead.

*Further reading:* [alignas](https://en.cppreference.com/w/cpp/language/alignas)

### Strict aliasing

You may access an object only through an lvalue of its own type (ignoring cv and signed/unsigned differences), or through `char`, `unsigned char` or `std::byte`. The compiler relies on this: it assumes an `int*` and a `float*` never point to the same object, so it can keep values in registers across stores. `*reinterpret_cast<std::uint32_t*>(&some_float)` is UB.

Correct ways to reinterpret bytes:

- `std::memcpy` into an object of the target type. Compilers turn small fixed-size `memcpy` into a single load or store, so it's free.
- `std::bit_cast<To>(from)` (C++20) for equally sized trivially copyable types; it's also `constexpr`.
- Union type punning (write one member, read another) is UB in C++ (unlike C). GCC and Clang document it as working, but it's non-portable.

*Further reading:* [Type aliasing (reinterpret\_cast)](https://en.cppreference.com/w/cpp/language/reinterpret_cast), [std::bit\_cast](https://en.cppreference.com/w/cpp/numeric/bit_cast)

### When does an object exist?

An object exists only if it was created by a definition, a `new` expression, a temporary, or a change of the active union member. Casting a pointer to a byte buffer doesn't create one. C++20 (P0593) added *implicit object creation*: `malloc`, `operator new`, `memcpy`, `memmove` and arrays of `unsigned char`/`std::byte` implicitly create objects of *implicit-lifetime types* (per \[class.prop\] and \[basic.types.general\]: scalar types, arrays, aggregates whose destructor isn't user-provided, and classes with at least one trivial eligible constructor plus a trivial, non-deleted destructor) when that makes the program's behavior defined. That retroactively blessed most C-style code.

Implicit creation never runs a constructor. A member whose type needs a non-trivial constructor to set up its invariants (a `std::string`, a `std::vector`) is never initialized in such storage, so assigning to it or calling its members is UB. Objects of such types must be constructed explicitly, with placement new or `construct_at`.

For a received network buffer, the C++23 `std::start_lifetime_as<T>(p)` explicitly starts the lifetime of a `T` over existing bytes, keeping their values; it still requires correct alignment. Library support is still limited, so `memcpy` remains the portable choice.

`std::launder` produces a usable pointer to a new object created in storage that previously held an object you still have a pointer to, needed in rare cases such as when the old object had `const` or reference members. You'll mostly need it to answer interview questions.

*Further reading:* [Object lifetime](https://en.cppreference.com/w/cpp/language/lifetime), [std::start\_lifetime\_as](https://en.cppreference.com/w/cpp/memory/start_lifetime_as), [std::launder](https://en.cppreference.com/w/cpp/utility/launder)

### Unions and manual lifetime

A union has at most one active member at a time. If any member has a non-trivial constructor, destructor, or copy or move operation, the union's corresponding special member is implicitly deleted, so the class wrapping it must define its own and manage the active member by hand:

- Start a member's lifetime with `std::construct_at(&u.member, args...)` (or placement new), and end it with `std::destroy_at(&u.member)` before switching members or destroying the wrapper.
- Track which member is active in a separate tag or `bool`; the union doesn't know.
- An `alignas(T) std::byte buf[sizeof(T)]` buffer works the same way; use the pointer that `construct_at` returns to reach the object.

*Trivially copyable* \[class.prop\] means: at least one eligible copy or move constructor or assignment operator, every eligible one trivial, and a trivial, non-deleted destructor. A wrapper whose special members are user-provided loses that property, even when the wrapped type is `int`. C++20 fixes this with *conditionally trivial* special members: declare several versions constrained with `requires`, and the most constrained one whose constraints hold is the eligible one.

```cpp run=none
~Optional() requires std::is_trivially_destructible_v<T> = default;
~Optional() { if (engaged_) std::destroy_at(ptr()); }
```

*Further reading:* [Union declaration](https://en.cppreference.com/w/cpp/language/union)

### Bytes on the wire

- `std::endian::native` (C++20) tells you the platform's byte order; x86-64 and ARM64 (Apple Silicon, AWS Graviton, …) are both little-endian, while network protocols are usually big-endian. `std::byteswap` (C++23) reverses bytes and compiles to one instruction (`bswap` on x86, `rev` on ARM).
- A little-endian machine stores the least significant byte at the lowest address; reading an object's bytes through `unsigned char*` is allowed and shows that order.
- `float` is IEEE 754 binary32 on every mainstream platform: from the top bit down, 1 sign bit, 8 exponent bits stored with a bias of 127, and 23 fraction bits, with an implicit leading 1 for normal numbers (`double` is 1, 11 with bias 1023, and 52).
- `std::aligned_storage` is deprecated in C++23; write `alignas(T) std::byte buf[sizeof(T)];`.
- Trivially copyable types (`std::is_trivially_copyable_v`) may be copied with `memcpy`. Polymorphic types and types with non-trivial copy operations may not.

*Further reading:* [std::endian](https://en.cppreference.com/w/cpp/types/endian), [std::byteswap](https://en.cppreference.com/w/cpp/numeric/byteswap)
