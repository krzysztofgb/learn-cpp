:::predict{#P1}
Summing a 4096×4096 `int` matrix stored row-major: row-by-row vs column-by-column.
::choices
- [ ] About the same speed
- [ ] Row-by-row about 1.5× faster
- [x] Row-by-row roughly 5–15× faster
- [ ] Column-by-column faster
::answer
Row-major many times faster: 14× measured (x86 VM, GCC 14 `-O2`); expect roughly 5–15×

Sequential access uses whole lines and the prefetcher; column order loads a new line (and often a new page) per element.
:::

:::predict{#P2}
```cpp run=none
for (int x : data) if (x >= 128) sum += x;   // data: 32M random bytes
```

On sorted vs unsorted `data`. Does `-O3` change the answer?
::choices
- [ ] Unsorted several times slower at any `-O` level
- [ ] Unsorted slower at `-O2`, equal only at `-O3`
- [x] Usually the same speed: compilers emit a branchless `cmov`
- [ ] Sorted slower: the sort leaves the data cold
::answer
Usually the same speed. GCC 14 and Clang 18 compile this to a branchless `cmov` even at `-O1`, and GCC vectorizes it at `-O3` (verified). With the branch forced to stay (`-fno-if-conversion -fno-tree-vectorize`), unsorted data is 7.9× slower.

The branch-prediction effect is real, but modern compilers usually remove the branch for a body this simple. Interview answer: explain the mechanism, then say you'd check the assembly.
:::

:::predict{#P3}
Traversing 1M ints in a `std::vector` vs a `std::list`.
::choices
- [ ] About the same: both traversals are O(n)
- [ ] Vector about 2× faster
- [x] Vector 10× to hundreds of times faster
- [ ] List faster: no reallocation or copying
::answer
Vector far faster: 10× vs a list whose nodes happen to be allocated in order, 436× vs a list with scattered nodes (both measured)

Contiguous, prefetchable; the list chases pointers to scattered nodes.
:::

:::predict{#P4}
Over a 256 MB `int` array: loop A touches every element; loop B touches every 16th element (one per 64-byte line). How do their times compare?
::choices
- [ ] B about 16× faster: it does 1/16 of the work
- [ ] B about 8× faster
- [x] B only about 2× faster
- [ ] B slower: strided access defeats the prefetcher
::answer
Much closer than the 16× difference in work: stride-16 measured only 2.3× faster

Both load every cache line; memory bandwidth, not instruction count, is the limit.
:::

:::predict{#P5}
Summing 10M doubles with one accumulator vs four accumulators (no `-ffast-math`).
::choices
- [ ] Same speed: the additions are identical
- [ ] Four accumulators \~4× faster, whatever the array size
- [x] \~3–4× faster in cache, much less on an 80 MB array
- [ ] One accumulator faster: fewer registers in use
::answer
Four accumulators \~3–4× faster when the data is in cache (4.1× measured on 32 KB); only 1.4× on an 80 MB array, where memory bandwidth is the limit

One accumulator serializes on FP-add latency; four run in parallel.
:::

:::predict{#P6}
Updating the `px` field of 1M orders stored as `struct Order { int64_t px; char other[56]; }` vs a separate `std::vector<int64_t> px`.
::choices
- [ ] About the same: one field is updated either way
- [x] Separate vector several times faster (\~8× less traffic)
- [ ] Struct faster: `px` is at offset 0
- [ ] Separate vector only \~10% faster
::answer
Separate vector \~8× less memory traffic, typically several times faster

AoS loads 64 bytes per 8 useful bytes.
:::
