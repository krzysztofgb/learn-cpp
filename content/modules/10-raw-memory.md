# Module 10: Raw memory, alignment and aliasing

Low-latency code builds objects in preallocated memory and decodes network buffers directly. That puts you right at the rules for object lifetime, alignment and strict aliasing, where "it works on my machine" code is often UB that a future compiler version will break.

## Notes

### 10.1 `new` is two steps

A `new T(args)` expression calls `operator new(sizeof(T))` to get raw memory, then constructs `T` in it. `delete p` runs the destructor, then calls `operator delete`. You can do each step yourself:

- **Placement new** `new (ptr) T(args)` constructs in memory you provide. You must later call `p->~T()` (or `std::destroy_at(p)`) yourself, and never `delete` it.
- `std::construct_at` and `std::destroy_at` (C++20) do the same and work in `constexpr`.
- You can replace global `operator new`/`delete` or provide class-specific versions, useful for counting allocations or pooling.
- Over-aligned types (`alignof(T) > alignof(std::max_align_t)`, typically 16) use the `std::align_val_t` overloads since C++17, so `new` respects `alignas(64)`.

Never mix families: `malloc` with `free`, `new` with `delete`, `new[]` with `delete[]`.

### 10.2 Alignment and layout

Every type has an alignment requirement (`alignof`); its address must be a multiple of it. Accessing a misaligned object is UB, even though x86 and modern ARM usually tolerate misaligned plain loads (atomics and some SIMD instructions don't).

The compiler lays out members in declaration order, inserting padding so each member is aligned, and pads the end so the size is a multiple of the struct's alignment (so arrays work). Ordering members from largest to smallest alignment minimizes padding. `alignas(64)` on a type or member forces cache-line alignment; `offsetof` gives member offsets for standard-layout types.

Packed structs (`__attribute__((packed))`) remove padding to match wire formats, but taking a pointer or reference to a misaligned member and using it is UB. Copy fields out instead.

### 10.3 Strict aliasing

You may access an object only through an lvalue of its own type (ignoring cv and signed/unsigned differences), or through `char`, `unsigned char` or `std::byte`. The compiler relies on this: it assumes an `int*` and a `float*` never point to the same object, so it can keep values in registers across stores. `*reinterpret_cast<std::uint32_t*>(&some_float)` is UB.

Correct ways to reinterpret bytes:

- `std::memcpy` into an object of the target type. Compilers turn small fixed-size `memcpy` into a single load or store, so it's free.
- `std::bit_cast<To>(from)` (C++20) for equally sized trivially copyable types; it's also `constexpr`.
- Union type punning (write one member, read another) is UB in C++ (unlike C). GCC and Clang document it as working, but it's non-portable.

### 10.4 When does an object exist?

An object exists only if it was created by a definition, a `new` expression, a temporary, or a change of the active union member. Casting a pointer to a byte buffer doesn't create one. C++20 (P0593) added *implicit object creation*: `malloc`, `operator new`, `memcpy`, `memmove` and arrays of `unsigned char`/`std::byte` implicitly create objects of *implicit-lifetime types* (per \[class.prop\] and \[basic.types.general\]: scalar types, arrays, aggregates whose destructor isn't user-provided, and classes with at least one trivial eligible constructor plus a trivial, non-deleted destructor) when that makes the program's behavior defined. That retroactively blessed most C-style code.

For a received network buffer, the C++23 `std::start_lifetime_as<T>(p)` explicitly starts the lifetime of a `T` over existing bytes, keeping their values; it still requires correct alignment. Library support is still limited, so `memcpy` remains the portable choice.

`std::launder` produces a usable pointer to a new object created in storage that previously held an object you still have a pointer to, needed in rare cases such as when the old object had `const` or reference members. You'll mostly need it to answer interview questions.

### 10.5 Bytes on the wire

- `std::endian::native` (C++20) tells you the platform's byte order; both your Mac and x86 are little-endian. `std::byteswap` (C++23) reverses bytes and compiles to one instruction (`bswap` on x86, `rev` on ARM).
- `std::aligned_storage` is deprecated in C++23; write `alignas(T) std::byte buf[sizeof(T)];`.
- Trivially copyable types (`std::is_trivially_copyable_v`) may be copied with `memcpy`. Polymorphic types and types with non-trivial copy operations may not.

## Predict the output

Assume 64-bit macOS.

**P1**

```cpp kind=fragment run=local
struct A { char c; double d; int i; };
struct B { double d; int i; char c; };
struct C { char a; char b; int i; };
cout << sizeof(A) << ' ' << sizeof(B) << ' '
     << sizeof(C) << ' ' << alignof(A);
```

**P2**

```cpp kind=fragment run=local
struct alignas(64) Line { int x; };
Line arr[2];
cout << sizeof(Line) << ' ' << alignof(Line) << ' ' << sizeof(arr);
```

**P3** What does Clang emit at `-O2` for this function?

```cpp kind=fragment run=godbolt note="This asks about generated code: read the -O2 assembly in Compiler Explorer."
int f(int* i, float* fl) {
    *i = 1;
    *fl = 2.0f;
    return *i;
}
```

**P4**

```cpp kind=fragment run=local
cout << std::hex << std::bit_cast<std::uint32_t>(1.0f);
```

**P5**

```cpp kind=fragment run=local
std::uint32_t x = 0x01020304;
auto* p = reinterpret_cast<unsigned char*>(&x);
cout << int(p[0]) << int(p[3]);
```

**P6**

```cpp kind=fragment run=local
struct T { T() { cout << '+'; } ~T() { cout << '-'; } };
{
    alignas(T) std::byte buf[sizeof(T)];
    T* t = new (buf) T();
}
cout << '|';
```

## Spot the UB

**U1**

```cpp kind=fragment run=local
float f = 1.0f;
std::uint32_t bits = *reinterpret_cast<std::uint32_t*>(&f);
```

**U2**

```cpp kind=fragment run=local
union U { float f; std::uint32_t u; };
U x;
x.f = 1.0f;
return x.u;
```

**U3**

```cpp kind=fragment run=local
struct Header { std::uint32_t seq; std::uint16_t len; };
std::uint32_t read_seq(const char* packet) {
    auto* h = reinterpret_cast<const Header*>(packet + 3);
    return h->seq;
}
```

**U4**

```cpp kind=fragment run=local
struct Instrument { std::string symbol; double tick; };
auto* in = static_cast<Instrument*>(std::malloc(sizeof(Instrument)));
in->symbol = "ESZ6";
```

**U5**

```cpp kind=fragment run=local
int* p = new int;
std::free(p);
```

**U6**

```cpp kind=fragment run=local
void reset(std::string& s) {
    s.~basic_string();
}
// called on a local std::string, which is later destroyed at scope end
```

## Exercises

**E1 ★ Layout audit.** For four structs from a market data message definition, print `offsetof` and `sizeof` for every member, compile with `-Wpadded`, then reorder members to minimize size. Report bytes saved.

**E2 ★★ Big-endian reads.** Implement `template <std::integral T> T read_be(const std::byte* p)` for unaligned buffers using `memcpy` and `std::byteswap`. Confirm on Compiler Explorer that it compiles to one load plus one `rev`/`bswap` on ARM64 and x86-64.

**E3 ★★ Object pool.** Implement `ObjectPool<T, N>`: aligned raw storage, a free list threaded through unused slots, `acquire(args...)` with placement new, and `release(T*)` calling the destructor. Verify under ASan that a double release or use-after-release is caught (hint: poison released slots with the ASan interface, or track state in debug builds).

**E4 ★★★ `Optional<T>`.** Implement it with a union or aligned buffer and a `bool`, using `construct_at` and `destroy_at`. Make copy and move correct, and make `Optional<int>` trivially copyable and trivially destructible using C++20 conditionally trivial special members (`~Optional() requires std::is_trivially_destructible_v<T> = default;`).

**E5 ★★ Three decoders.** Decode a packed 20-byte binary message into a struct three ways: `memcpy` per field, `std::bit_cast` from `std::array<std::byte, N>`, and `reinterpret_cast`. Compare the generated assembly and state which are legal.

## Interview questions

1. What is placement new? How do you destroy an object created with it?
2. What's the difference between `operator new` and a `new` expression?
3. What is the strict aliasing rule, and why does it exist?
4. How do you correctly reinterpret the bits of a `float` as an integer?
5. What is alignment? What happens with misaligned access?
6. How does struct padding work, and how do you minimize it?
7. What does "trivially copyable" mean, and why does it matter?
8. How would you parse a binary market data message without UB and without extra copies?
9. What does `std::launder` do?
10. `new` vs `malloc`?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `24 16 8 8` | `A`: 1 + 7 padding + 8 + 4 + 4 tail padding. `B`: 8 + 4 + 1 + 3 tail. `C`: 1 + 1 + 2 + 4. |
| P2 | `64 64 128` | Size is rounded up to the alignment so array elements stay aligned. |
| P3 | `return 1` after the stores | Strict aliasing lets the compiler assume `fl` doesn't point at `*i`. |
| P4 | `3f800000` | IEEE 754: sign 0, exponent 127, mantissa 0. |
| P5 | `41` | Little-endian: the lowest byte comes first. Access through `unsigned char` is allowed. |
| P6 | `+\|` | Nobody called the destructor. For a type with side effects in its destructor, that's a leak, not UB, as long as nothing depends on it. |

### Spot the UB

- **U1:** Strict aliasing violation. Use `std::bit_cast<std::uint32_t>(f)`.
- **U2:** UB in C++: reading an inactive union member. GCC and Clang define it as an extension; portable code uses `bit_cast`.
- **U3:** Misaligned access (offset 3) and accessing bytes as a `Header` object that doesn't exist (and `Header` has 2 bytes of tail padding the wire format may not). Use `memcpy` of each field, then byte-swap if the wire is big-endian.
- **U4:** No constructor ever ran for the `std::string` member, so `symbol =` calls assignment on an object that was never initialized: UB. Implicit object creation can't help, because `std::string` needs its constructor to establish its invariants. Use placement new or just `new`.
- **U5:** Mismatched allocation and deallocation functions.
- **U6:** The string is destroyed twice: once explicitly and again at scope end. Use `s.clear()` or `s = {}`.

### Exercise hints

- **E2:** Copy into a `T`, then `if constexpr (std::endian::native == std::endian::little) v = std::byteswap(v);`.
- **E3:** Store the free-list `next` pointer inside the unused slot's storage, so the pool needs no extra memory.
- **E5:** `memcpy` and `bit_cast` are legal and compile to the same loads. `reinterpret_cast` is UB unless the buffer actually contains such an object, and may also be misaligned.

### Interview questions

1. It constructs an object in pre-allocated memory: `new (buf) T(args)`. Destroy it by calling the destructor explicitly, then free the memory however it was obtained.
2. `operator new` only allocates raw bytes (like `malloc` but throws). The `new` expression calls it and then runs the constructor.
3. An object may be accessed only through its own type or a byte type. It lets compilers assume pointers of different types don't alias, enabling reordering, register caching and vectorization.
4. `std::bit_cast<std::uint32_t>(f)`, or `memcpy` into a `std::uint32_t`.
5. Objects of a type must start at addresses that are multiples of its alignment. Misaligned access is UB; in practice it can be slower, fault on some instructions, or break atomicity.
6. The compiler adds padding before members to align them and at the end to align the size. Sort members by decreasing alignment, and use smaller types where possible.
7. Copying it with `memcpy` produces an equivalent object: no non-trivial copy or move operations, and a trivial destructor. It enables `memcpy`, `bit_cast` and many container optimizations.
8. Read each field with `memcpy` into a local of the right type (compiles to plain loads), byte-swap as needed, and work with prices as integers. In C++23, `start_lifetime_as` on aligned buffers is an option where supported.
9. It returns a pointer to an object created in storage previously occupied by another object, when using the old pointer would be invalid. Rarely needed outside low-level containers.
10. `new` constructs objects, throws on failure and is type-safe; `malloc` returns raw bytes, returns null on failure, and doesn't construct non-trivial types.
