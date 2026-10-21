### Iterator categories

Input (single pass) → forward (multi-pass) → bidirectional (`--`) → random access (`it + n`, O(1)) → contiguous (C++20, elements adjacent in memory). Algorithms state the minimum they need: `std::sort` needs random access, which is why `std::list` has its own `sort` member.

### Algorithms worth knowing cold

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

### Strict weak ordering

Comparators passed to `sort`, `map` and friends must be a strict weak ordering: irreflexive (`!(a < a)`), asymmetric, transitive, and with transitive equivalence (if a\~b and b\~c then a\~c, where \~ means neither is less). Violating it is UB, and with `std::sort` it can read out of bounds and crash. Classic violations: `<=` as a comparator, comparing floating-point values when NaN is present, and comparators that look at different fields inconsistently.

### Ranges

Range algorithms (`std::ranges::sort(v)`) take a whole range, are constrained by concepts (clearer errors), and support *projections*: `std::ranges::sort(orders, std::less{}, &Order::px)` sorts by a member without writing a lambda.

Views are lazy, cheap-to-copy adaptors composed with `|`: `filter`, `transform`, `take`, `drop`, `reverse`, `iota`, `split`, `join`, `keys`, `values`, and in C++23 `zip`, `enumerate`, `chunk`, `slide`, `adjacent` and `std::ranges::to` for materializing.

Things to know about views:

- Nothing runs until you iterate, and `transform` runs again each time an element is dereferenced.
- `filter_view` caches its `begin()` after the first call, so it isn't const-iterable and modifying elements so the predicate no longer holds is UB.
- Range algorithms called on an rvalue container return `std::ranges::dangling` instead of an iterator, so `*std::ranges::find(make_vec(), 3)` doesn't compile. That's protection, not a bug.
- Complex view pipelines can block auto-vectorization and slow compilation; measure hot loops.
