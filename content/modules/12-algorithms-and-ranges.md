# Module 12: Algorithms and ranges

The standard algorithms are well-tested and often vectorized; knowing them saves interview time and bugs. Ranges (C++20) add composable lazy views, which bring their own surprises about when code actually runs.

## Notes

### 12.1 Iterator categories

Input (single pass) → forward (multi-pass) → bidirectional (`--`) → random access (`it + n`, O(1)) → contiguous (C++20, elements adjacent in memory). Algorithms state the minimum they need: `std::sort` needs random access, which is why `std::list` has its own `sort` member.

### 12.2 Algorithms worth knowing cold

| Algorithm | Complexity | Notes |
| --- | --- | --- |
| `sort` | O(n log n) | Introsort (quicksort, switching to heapsort on bad recursion depth, insertion sort for small ranges). Not stable. |
| `stable_sort` | O(n log n), O(n log² n) without extra memory | Merge sort; keeps equal elements in order |
| `partial_sort` | O(n log k) | Heap-based; the first k are sorted |
| `nth_element` | O(n) average | Introselect; puts the nth element in place, partitions around it. Use it for medians and percentiles. |
| `lower_bound` / `upper_bound` / `equal_range` | O(log n) | First element `>= x` / first `> x`; range must be partitioned |
| `partition`, `stable_partition` | O(n) |  |
| `unique` | O(n) | Removes *adjacent* duplicates only; sort first |
| `remove` / `remove_if` | O(n) | Shifts survivors forward and returns new end; doesn't erase. C++20 `std::erase_if` does both. |
| `accumulate` | O(n) | Strict left-to-right; the result type is the init value's type |
| `reduce`, `transform_reduce` | O(n) | May reorder and regroup, so floating-point results can differ run to run; can be parallel |
| `make_heap`, `push_heap`, `pop_heap` | O(n), O(log n) | Binary heap over a random access range |

Execution policies (`std::execution::par`, `par_unseq`) exist since C++17, but libc++ support is limited; GCC uses Intel TBB.

### 12.3 Strict weak ordering

Comparators passed to `sort`, `map` and friends must be a strict weak ordering: irreflexive (`!(a < a)`), asymmetric, transitive, and with transitive equivalence (if a\~b and b\~c then a\~c, where \~ means neither is less). Violating it is UB, and with `std::sort` it can read out of bounds and crash. Classic violations: `<=` as a comparator, comparing floating-point values when NaN is present, and comparators that look at different fields inconsistently.

### 12.4 Ranges

Range algorithms (`std::ranges::sort(v)`) take a whole range, are constrained by concepts (clearer errors), and support *projections*: `std::ranges::sort(orders, std::less{}, &Order::px)` sorts by a member without writing a lambda.

Views are lazy, cheap-to-copy adaptors composed with `|`: `filter`, `transform`, `take`, `drop`, `reverse`, `iota`, `split`, `join`, `keys`, `values`, and in C++23 `zip`, `enumerate`, `chunk`, `slide`, `adjacent` and `std::ranges::to` for materializing.

Things to know about views:

- Nothing runs until you iterate, and `transform` runs again each time an element is dereferenced.
- `filter_view` caches its `begin()` after the first call, so it isn't const-iterable and modifying elements so the predicate no longer holds is UB.
- Range algorithms called on an rvalue container return `std::ranges::dangling` instead of an iterator, so `*std::ranges::find(make_vec(), 3)` doesn't compile. That's protection, not a bug.
- Complex view pipelines can block auto-vectorization and slow compilation; measure hot loops.

## Predict the output

**P1**

```cpp kind=fragment run=local
std::vector<int> v{5, 1, 4, 2, 3};
std::nth_element(v.begin(), v.begin() + 2, v.end());
cout << v[2];
```

**P2**

```cpp kind=fragment run=local
std::vector<int> v{1, 2, 2, 2, 3};
cout << (std::lower_bound(v.begin(), v.end(), 2) - v.begin())
     << (std::upper_bound(v.begin(), v.end(), 2) - v.begin());
```

**P3**

```cpp kind=fragment run=local
std::vector<int> v{1, 1, 2, 1, 1};
v.erase(std::unique(v.begin(), v.end()), v.end());
cout << v.size();
```

**P4**

```cpp kind=fragment run=local
auto sq = [](int x) { cout << 's' << x << ' '; return x * x; };
auto view = std::views::iota(1, 100)
          | std::views::transform(sq)
          | std::views::take(2);
cout << "start ";
for (int x : view) cout << x << ' ';
```

**P5**

```cpp kind=fragment run=local
auto dbl = [](int x) { cout << 't'; return x * 2; };
for (int x : std::views::iota(0, 3)
           | std::views::transform(dbl)
           | std::views::filter([](int x) { return x > 0; }))
    cout << x;
```

**P6**

```cpp kind=fragment run=local
std::vector<double> v{0.5, 0.5, 0.5};
cout << std::accumulate(v.begin(), v.end(), 0) << ' '
     << std::accumulate(v.begin(), v.end(), 0.0);
```

## Spot the UB

**U1**

```cpp kind=fragment run=none
std::sort(px.begin(), px.end(), [](int a, int b) { return a <= b; });
```

**U2**

```cpp kind=fragment run=none
std::vector<double> prices = load();   // may contain NaN
std::sort(prices.begin(), prices.end());
```

**U3**

```cpp kind=fragment run=local
std::vector<int> v{5, 3, 9, 1};
bool found = std::binary_search(v.begin(), v.end(), 9);
```

**U4**

```cpp kind=fragment run=local
std::vector<int> src{1, 2, 3}, dst;
std::copy(src.begin(), src.end(), dst.begin());
```

**U5**

```cpp kind=fragment run=local
std::vector<int> v{2, 4, 5, 6};
auto evens = v | std::views::filter([](int x) { return x % 2 == 0; });
for (int& x : evens) x += 1;
```

**U6**

```cpp kind=fragment run=local
std::vector<int> make_vec();
auto it = std::ranges::find(make_vec(), 3);
std::cout << *it;
```

## Exercises

**E1 ★ Loops to algorithms.** Rewrite six hand-written loops (counting matches, checking any/all, finding min and max together, finding the first adjacent duplicate, splitting by predicate, computing running sums) using standard algorithms, then using `std::ranges` with projections.

**E2 ★★ Quickselect.** Implement quickselect with a median-of-three pivot and compare against `std::nth_element` on random, sorted and many-duplicates inputs. Use it to compute p50, p99 and p99.9 of 10M latency samples.

**E3 ★★ VWAP.** Given a vector of `Trade{symbol_id, px, qty}`, compute the volume-weighted average price for one symbol: once with views (`filter` + `transform`) and `std::ranges::fold_left` (C++23), once as a hand-written loop. Compare generated code and speed.

**E4 ★★ Comparator checker.** Write the comparator for bid-side priority (price descending, then time ascending). Then write `check_strict_weak_ordering(range, comp)` that tests irreflexivity, asymmetry and transitivity on random triples, and show it catching a buggy comparator.

**E5 ★★★ A custom view.** Implement an `enumerate`-style view adaptor (if your library lacks C++23's) that yields `(index, element)` pairs and works with `|`, using `std::ranges::view_interface` and a range adaptor closure.

## Interview questions

1. What algorithm does `std::sort` use, and what's its worst case?
2. Stable vs unstable sort: when does stability matter?
3. How would you find the median or p99 of a large array efficiently?
4. What is a strict weak ordering, and what happens if a comparator violates it?
5. `lower_bound` vs `upper_bound`?
6. Explain the erase-remove idiom and what C++20 changed.
7. `accumulate` vs `reduce`?
8. What do ranges add over iterator-pair algorithms?
9. What are the pitfalls of lazy views?
10. Find the top k of n elements: options and complexities.

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `3` | The element at index 2 is what a full sort would put there. |
| P2 | `14` | First 2 at index 1; first element greater than 2 at index 4. |
| P3 | `3` | Only adjacent duplicates collapse: `1 2 1`. |
| P4 | ` start s1 1 s2 4  ` | Nothing runs until iteration; each element is transformed once when dereferenced. |
| P5 | `ttt2tt4` | `filter` dereferences to test the predicate, then the loop dereferences again, calling the transform a second time for each passing element. |
| P6 | `0 1.5` | With `int` init, each step truncates: 0 + 0.5 → 0. |

### Spot the UB

- **U1:** UB: `<=` isn't irreflexive. `std::sort` may run past the end of the range. Use `<`.
- **U2:** UB if NaN is present: every comparison with NaN is false, breaking transitivity of equivalence. Filter NaNs first, or sort with `std::ranges::sort` and a comparator based on `std::strong_order` for doubles (C++20 total order).
- **U3:** Precondition violation: the range must be partitioned with respect to the value. Formally UB; in practice a wrong answer.
- **U4:** UB: writes past the end of an empty vector. Use `std::back_inserter(dst)` or `dst.resize` first.
- **U5:** UB: after incrementing, 2 becomes 3, which no longer satisfies the predicate, which `filter_view` forbids.
- **U6:** Doesn't compile: `it` is `std::ranges::dangling`. The library caught a use-after-free for you.

### Exercise hints

- **E2:** Median-of-three avoids the quadratic behavior on sorted input; with many duplicates, use three-way partitioning.
- **E3:** The view version computes `px * qty` lazily; check whether the compiler fused and vectorized it as well as the loop.
- **E4:** Bugs to try: comparing price with `>=`, or comparing time only when prices differ in one direction.

### Interview questions

1. Introsort: quicksort with median-of-three pivoting, falling back to heapsort when recursion depth exceeds about 2 log n, and insertion sort for small partitions. Worst case O(n log n), guaranteed since C++11.
2. Stable sort preserves the relative order of equal elements; it matters when sorting by multiple keys in passes, or preserving time priority among equal prices.
3. `std::nth_element` (O(n) average). For streams or many percentiles, use a histogram (Module 23).
4. A comparator that's irreflexive, asymmetric and transitive, with transitive equivalence. Violations are UB: wrong results, broken containers, out-of-bounds access in `sort`.
5. `lower_bound` returns the first element not less than the value; `upper_bound` the first greater than it. Together they bound the equal range.
6. `remove` moves kept elements forward and returns the new logical end; `erase` then trims the container. C++20's `std::erase` and `std::erase_if` do both in one call.
7. `accumulate` is strictly sequential left fold; `reduce` requires an associative, commutative operation and may regroup or parallelize, which changes floating-point results.
8. Whole-range arguments, concepts for clearer errors, projections, lazy composable views, sentinels, and dangling-iterator protection.
9. Deferred execution (side effects run later or repeatedly), repeated transform calls, `filter`'s cached `begin`, views referencing dead containers, and code generation that's harder to optimize.
10. Full sort O(n log n); `partial_sort` O(n log k); `nth_element` then sort the k, O(n + k log k); a min-heap of size k while streaming, O(n log k) with O(k) memory.
