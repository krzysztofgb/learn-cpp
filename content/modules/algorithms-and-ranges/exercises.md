:::exercise{#E1 level=warm-up title="Loops to algorithms"}
Rewrite six hand-written loops (counting matches, checking any/all, finding min and max together, finding the first adjacent duplicate, splitting by predicate, computing running sums) using standard algorithms, then using `std::ranges` with projections.
:::

:::exercise{#E2 level=standard title="Quickselect"}
Implement quickselect with a median-of-three pivot and compare against `std::nth_element` on random, sorted and many-duplicates inputs. Use it to compute p50, p99 and p99.9 of 10M latency samples.
::hint
Median-of-three avoids the quadratic behavior on sorted input; with many duplicates, use three-way partitioning.
:::

:::exercise{#E3 level=standard title="VWAP"}
Given a vector of `Trade{symbol_id, px, qty}`, compute the volume-weighted average price for one symbol: once with views (`filter` + `transform`) and `std::ranges::fold_left` (C++23), once as a hand-written loop. Compare generated code and speed.
::hint
The view version computes `px * qty` lazily; check whether the compiler fused and vectorized it as well as the loop.
:::

:::exercise{#E4 level=standard title="Comparator checker"}
Write the comparator for bid-side priority (price descending, then time ascending). Then write `check_strict_weak_ordering(range, comp)` that tests irreflexivity, asymmetry and transitivity on random triples, and show it catching a buggy comparator.
::hint
Bugs to try: comparing price with `>=`, or comparing time only when prices differ in one direction.
:::

:::exercise{#E5 level=interview-hard title="A custom view"}
Implement an `enumerate`-style view adaptor (if your library lacks C++23's) that yields `(index, element)` pairs and works with `|`, using `std::ranges::view_interface` and a range adaptor closure.
:::
