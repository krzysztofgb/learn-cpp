:::predict{#P1}
What can Clang emit for this function at `-O2 -ffast-math`?

```cpp run=godbolt note="This asks about generated code: read the -O2 -ffast-math assembly in Compiler Explorer."
bool bad(double x) { return std::isnan(x); }
```
::answer
`return false`

Fast-math lets the compiler assume NaN never occurs.
:::

:::predict{#P2}
```cpp
std::array<std::byte, 1024> buf;
std::pmr::monotonic_buffer_resource res(buf.data(), buf.size(),
                                        std::pmr::null_memory_resource());
std::pmr::vector<int> v(&res);
for (int i = 0; i < 300; ++i) v.push_back(i);
```
::answer
Throws `std::bad_alloc` while pushing the 129th element

Growth allocates 4, 8, ..., 512 bytes (1020 total, never reused), leaving no room for the 1024-byte buffer.
:::

:::predict{#P3}
Which is faster for checking whether a symbol ID is one of 8 IDs: a linear scan of a `std::array<int, 8>` or `std::unordered_set<int>::contains`?
::answer
Linear scan

32 bytes in one or two cache lines, branch-friendly or vectorized; hashing plus a bucket chase costs more.
:::

:::predict{#P4}
Which costs more, `x / 10` or `x / d` where `d` is a runtime variable holding 10? Why?
::answer
`x / d`

Constant division becomes a multiply and shift (\~3–5 cycles); runtime division uses the slow divide instruction.
:::

:::predict{#P5}
A hot loop calls a callback 10M times. Rank by speed: a template parameter, a function pointer, `std::function`.
::answer
Template, then function pointer, then `std::function`

The template inlines; the pointer is an indirect call; `std::function` adds type erasure on top.
:::
