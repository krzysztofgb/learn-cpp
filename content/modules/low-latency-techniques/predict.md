:::predict{#P1}
What can Clang emit for this function at `-O2 -ffast-math`?

```cpp run=godbolt note="This asks about generated code: read the -O2 -ffast-math assembly in Compiler Explorer."
bool bad(double x) { return std::isnan(x); }
```
::choices
- [ ] A self-compare, `x != x`
- [x] `return false`
- [ ] `return true`
- [ ] A call to the library `isnan`
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
::choices
- [ ] Runs fine: `v` ends with 300 elements
- [ ] Falls back to the heap once `buf` is full
- [x] Throws `std::bad_alloc` while pushing the 129th element
- [ ] Throws `std::bad_alloc` while pushing the 257th element
- [ ] UB: the vector writes past the end of `buf`
::answer
Throws `std::bad_alloc` while pushing the 129th element

Growth allocates 4, 8, ..., 512 bytes (1020 total, never reused), leaving no room for the 1024-byte buffer.
:::

:::predict{#P3}
Which is faster for checking whether a symbol ID is one of 8 IDs: a linear scan of a `std::array<int, 8>` or `std::unordered_set<int>::contains`?
::choices
- [ ] `unordered_set::contains`: O(1) beats O(n)
- [x] The linear scan of the array
- [ ] About the same at this size
::answer
Linear scan

32 bytes in one or two cache lines, branch-friendly or vectorized; hashing plus a bucket chase costs more.
:::

:::predict{#P4}
Which costs more, `x / 10` or `x / d` where `d` is a runtime variable holding 10? Why?
::choices
- [ ] `x / 10`: the constant must be loaded first
- [ ] Same cost: both use the divide instruction
- [x] `x / d`: a constant divisor becomes multiply and shift
- [ ] `x / d`: `d` must be loaded from memory
::answer
`x / d`

Constant division becomes a multiply and shift (\~3–5 cycles); runtime division uses the slow divide instruction.
:::

:::predict{#P5}
A hot loop calls a callback 10M times. Rank by speed: a template parameter, a function pointer, `std::function`.
::choices
- [ ] Function pointer, template, `std::function`
- [x] Template, function pointer, `std::function`
- [ ] Template, `std::function`, function pointer
- [ ] All three the same at `-O2`
::answer
Template, then function pointer, then `std::function`

The template inlines; the pointer is an indirect call; `std::function` adds type erasure on top.
:::
