Assume 64-bit macOS.

:::predict{#P1}
```cpp
struct A { char c; double d; int i; };
struct B { double d; int i; char c; };
struct C { char a; char b; int i; };
cout << sizeof(A) << ' ' << sizeof(B) << ' '
     << sizeof(C) << ' ' << alignof(A);
```
::answer
`24 16 8 8`

`A`: 1 + 7 padding + 8 + 4 + 4 tail padding. `B`: 8 + 4 + 1 + 3 tail. `C`: 1 + 1 + 2 + 4.
:::

:::predict{#P2}
```cpp
struct alignas(64) Line { int x; };
Line arr[2];
cout << sizeof(Line) << ' ' << alignof(Line) << ' ' << sizeof(arr);
```
::answer
`64 64 128`

Size is rounded up to the alignment so array elements stay aligned.
:::

:::predict{#P3}
What does Clang emit at `-O2` for this function?

```cpp run=godbolt note="This asks about generated code: read the -O2 assembly in Compiler Explorer."
int f(int* i, float* fl) {
    *i = 1;
    *fl = 2.0f;
    return *i;
}
```
::answer
`return 1` after the stores

Strict aliasing lets the compiler assume `fl` doesn't point at `*i`.
:::

:::predict{#P4}
```cpp
cout << std::hex << std::bit_cast<std::uint32_t>(1.0f);
```
::answer
`3f800000`

IEEE 754: sign 0, exponent 127, mantissa 0.
:::

:::predict{#P5}
```cpp
std::uint32_t x = 0x01020304;
auto* p = reinterpret_cast<unsigned char*>(&x);
cout << int(p[0]) << int(p[3]);
```
::answer
`41`

Little-endian: the lowest byte comes first. Access through `unsigned char` is allowed.
:::

:::predict{#P6}
```cpp
struct T { T() { cout << '+'; } ~T() { cout << '-'; } };
{
    alignas(T) std::byte buf[sizeof(T)];
    T* t = new (buf) T();
}
cout << '|';
```
::answer
`+|`

Nobody called the destructor. For a type with side effects in its destructor, that's a leak, not UB, as long as nothing depends on it.
:::
