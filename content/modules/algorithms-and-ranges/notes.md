### Iterator categories

Input (single pass) → forward (multi-pass) → bidirectional (`--`) → random access (`it + n`, O(1)) → contiguous (C++20, elements adjacent in memory). Algorithms state the minimum they need: `std::sort` needs random access, which is why `std::list` has its own `sort` member.

Algorithms never change a container's size: they see only iterators. An output iterator such as `dst.begin()` must point at enough existing elements to receive every write, so `std::copy(src.begin(), src.end(), dst.begin())` into an empty `dst` writes past its end (UB). Either size the destination first (`dst.resize(src.size())`) or pass an insert iterator: `std::back_inserter(dst)` turns each write into `dst.push_back(x)`.

*Further reading:* [Introduction to iterators](https://www.learncpp.com/cpp-tutorial/introduction-to-iterators/), [STL iterators overview](https://www.learncpp.com/cpp-tutorial/stl-iterators-overview/)

### Algorithms worth knowing cold

| Algorithm | Complexity | Notes |
| --- | --- | --- |
| `sort` | O(n log n) | Introsort (quicksort, switching to heapsort on bad recursion depth, insertion sort for small ranges). Not stable. |
| `stable_sort` | O(n log n), O(n log² n) without extra memory | Merge sort; keeps equal elements in order |
| `partial_sort` | O(n log k) | Heap-based; the first k are sorted |
| `nth_element` | O(n) average | Introselect; puts the nth element in place, partitions around it. Use it for medians and percentiles. |
| `lower_bound` / `upper_bound` / `equal_range` / `binary_search` | O(log n) | First element `>= x` / first `> x` / both / whether one is equivalent to `x`; range must be partitioned with respect to `x` |
| `partition`, `stable_partition` | O(n) |  |
| `unique` | O(n) | Removes *adjacent* duplicates only; sort first |
| `remove` / `remove_if` | O(n) | Shifts survivors forward and returns new end; doesn't erase. C++20 `std::erase_if` does both. |
| `accumulate` | O(n) | Strict left-to-right; the result type is the init value's type |
| `reduce`, `transform_reduce` | O(n) | May reorder and regroup, so floating-point results can differ run to run; can be parallel |
| `make_heap`, `push_heap`, `pop_heap` | O(n), O(log n) | Binary heap over a random access range |

Details that the table compresses:

- `std::sort` has been required to do O(n log n) comparisons in the worst case since C++11 (C++03 only asked for that on average), which is why implementations use introsort: quicksort with a median-of-three pivot, a switch to heapsort once recursion depth passes about 2 log₂ n, and insertion sort for partitions of a few elements. A plain quicksort or quickselect that always picks the first element as pivot is quadratic on already-sorted input, and a two-way partition degrades on inputs with many equal keys; three-way partitioning (less, equal, greater) fixes the second.
- Stability matters when equal keys carry other information: time priority among orders at the same price, or sorting by several keys in passes (sort by the secondary key, then `stable_sort` by the primary).
- The binary searches have a precondition, not a check: the range must be partitioned with respect to the value (sorted is enough). On an unsorted range the call is UB; in practice it returns a wrong answer.
- `accumulate(first, last, init)` computes `init = init + *it` for each element with `init` of type `T`, the type of the init argument. With `0` (an `int`), each step converts the sum back to `int` and truncates. C++23's `std::ranges::fold_left(r, init, op)` is the ranges version; its result type is the type of `op(init, *it)` (decayed), so `fold_left(doubles, 0, std::plus{})` returns a `double`.
- `reduce` requires the operation to be associative and commutative, because it may regroup and reorder elements; with floating point neither holds exactly, so results differ from `accumulate` and between runs.
- `nth_element` costs O(n) on average; for many percentiles over a stream, use a histogram instead (:sec[measurement/histograms]).

Other algorithms that replace common hand-written loops: `count_if`, `any_of` / `all_of` / `none_of`, `minmax_element` (both in one pass), `adjacent_find` (first pair of equal neighbours), `partition_copy` (split by a predicate into two outputs), `partial_sum` and `inclusive_scan` (running sums), `find_if`, `mismatch`, `transform`.

Execution policies (`std::execution::par`, `par_unseq`) exist since C++17, but libc++ support is limited; libstdc++ uses Intel TBB as its parallel backend.

*Further reading:* [Introduction to standard library algorithms](https://www.learncpp.com/cpp-tutorial/introduction-to-standard-library-algorithms/), [STL algorithms overview](https://www.learncpp.com/cpp-tutorial/stl-algorithms-overview/)

### Strict weak ordering

Comparators passed to `sort`, `map` and friends must be a strict weak ordering: irreflexive (`!(a < a)`), asymmetric, transitive, and with transitive equivalence (if a\~b and b\~c then a\~c, where \~ means neither is less). Violating it is UB, and with `std::sort` it can read out of bounds and crash. Classic violations: `<=` as a comparator, comparing floating-point values when NaN is present (every comparison with NaN is false, so NaN is "equivalent" to everything and equivalence stops being transitive), and comparators that look at different fields inconsistently.

To compare by several keys, compare the keys lexicographically: `std::tie(a.px, a.time) < std::tie(b.px, b.time)`. Swap one key's sides for descending order on that key: `std::tie(b.px, a.time) < std::tie(a.px, b.time)` orders price descending, then time ascending. For floating point that may contain NaN, C++20's `std::strong_order(a, b) < 0` is a total order over all IEEE values (it orders −0 before +0 and places NaNs at the ends by sign), so it's a valid comparator where `<` isn't.

### Ranges

Range algorithms (`std::ranges::sort(v)`) take a whole range, are constrained by concepts (clearer errors), and support *projections*: `std::ranges::sort(orders, std::less{}, &Order::px)` sorts by a member without writing a lambda. A range is an iterator plus a *sentinel* that marks the end and may have a different type from the iterator, so a null-terminated string or an unbounded sequence (`std::unreachable_sentinel`) is a range without computing its end first.

Views are lazy, cheap-to-copy adaptors composed with `|`: `filter`, `transform`, `take`, `drop`, `reverse`, `iota`, `split`, `join`, `keys`, `values`, and in C++23 `zip`, `enumerate`, `chunk`, `slide`, `adjacent` and `std::ranges::to` for materializing.

Things to know about views:

- Nothing runs until you iterate. A view pipeline pulls one element at a time from its source as the outer loop advances, and `take(n)` stops after n elements, so later elements are never computed.
- `transform` runs its function each time an element is dereferenced; nothing is cached. `filter` dereferences the underlying iterator to test its predicate, and dereferencing the filter iterator dereferences the underlying one again, so a `transform` before a `filter` runs twice for every element that passes.
- `filter_view` caches its `begin()` after the first call, so it isn't const-iterable and modifying elements so the predicate no longer holds is UB.
- A view over an lvalue container stores a pointer to it, not a copy: if the container dies first, the view dangles. Piping an rvalue container (`make_vec() | views::filter(f)`) moves it into an `owning_view` (C++20, by defect report P2415), which is safe.
- Range algorithms called on an rvalue container return `std::ranges::dangling` instead of an iterator, so `*std::ranges::find(make_vec(), 3)` doesn't compile. That's protection, not a bug.
- Complex view pipelines can block auto-vectorization and slow compilation; measure hot loops.

### Writing a view

A view is a range that's cheap to move and destroy (O(1)) and is marked as a view, usually by deriving from `std::ranges::view_interface<Derived>`. You write `begin()` and `end()` (with your own iterator type that models at least `std::input_iterator`), and `view_interface` supplies `empty()`, `operator bool`, `front()`, `back()`, `size()` and `operator[]` when the iterator category allows them. To make an adaptor work with `|`, give it a closure object: in C++23, derive the closure type from `std::ranges::range_adaptor_closure<Closure>` and give it `operator()(R&& r)` returning your view; in C++20, define `operator|(R&&, Closure)` yourself.

*Further reading:* [Ranges library on cppreference](https://en.cppreference.com/w/cpp/ranges)
