:::question{#Q1}
What algorithm does `std::sort` use, and what's its worst case?
::answer
Introsort: quicksort with median-of-three pivoting, falling back to heapsort when recursion depth exceeds about 2 log n, and insertion sort for small partitions. Worst case O(n log n), guaranteed since C++11.
:::

:::question{#Q2}
Stable vs unstable sort: when does stability matter?
::answer
Stable sort preserves the relative order of equal elements; it matters when sorting by multiple keys in passes, or preserving time priority among equal prices.
:::

:::question{#Q3}
How would you find the median or p99 of a large array efficiently?
::answer
`std::nth_element` (O(n) average). For streams or many percentiles, use a histogram (:mod[measurement]).
:::

:::question{#Q4}
What is a strict weak ordering, and what happens if a comparator violates it?
::answer
A comparator that's irreflexive, asymmetric and transitive, with transitive equivalence. Violations are UB: wrong results, broken containers, out-of-bounds access in `sort`.
:::

:::question{#Q5}
`lower_bound` vs `upper_bound`?
::answer
`lower_bound` returns the first element not less than the value; `upper_bound` the first greater than it. Together they bound the equal range.
:::

:::question{#Q6}
Explain the erase-remove idiom and what C++20 changed.
::answer
`remove` moves kept elements forward and returns the new logical end; `erase` then trims the container. C++20's `std::erase` and `std::erase_if` do both in one call.
:::

:::question{#Q7}
`accumulate` vs `reduce`?
::answer
`accumulate` is strictly sequential left fold; `reduce` requires an associative, commutative operation and may regroup or parallelize, which changes floating-point results.
:::

:::question{#Q8}
What do ranges add over iterator-pair algorithms?
::answer
Whole-range arguments, concepts for clearer errors, projections, lazy composable views, sentinels, and dangling-iterator protection.
:::

:::question{#Q9}
What are the pitfalls of lazy views?
::answer
Deferred execution (side effects run later or repeatedly), repeated transform calls, `filter`'s cached `begin`, views referencing dead containers, and code generation that's harder to optimize.
:::

:::question{#Q10}
Find the top k of n elements: options and complexities.
::answer
Full sort O(n log n); `partial_sort` O(n log k); `nth_element` then sort the k, O(n + k log k); a min-heap of size k while streaming, O(n log k) with O(k) memory.
:::
