:::exercise{#E1 level=warm-up title="Invalidation lab"}
For `vector`, `deque`, `list`, `map` and `unordered_map`, write a test per invalidation rule that holds an iterator and a reference across an insert and an erase. Run under ASan and record which accesses it flags.
:::

:::exercise{#E2 level=standard title="`Vector<T>`"}
Implement a vector without allocator support: `push_back`, `emplace_back`, `pop_back`, `reserve`, `resize`, `erase`, iterators, copy and move. Grow with `std::move_if_noexcept` and `std::uninitialized_*` algorithms so reallocation gives the strong guarantee. (:mod[implement-from-scratch] revisits this under interview time pressure.)
:::

:::exercise{#E3 level=standard title="Lookup benchmark"}
For 1K, 100K and 10M random `int64_t` keys, time lookups and full iteration in `std::map`, `std::unordered_map`, a sorted `vector` with `lower_bound`, and `std::flat_map` (or Boost's). Explain the crossover points.
::hint
Sorted vectors usually win for read-heavy workloads at all sizes because of contiguity; hash maps win on random lookups at large sizes; `std::map` rarely wins anything except stable iterators and ordered mutation.
:::

:::exercise{#E4 level=standard title="Ring buffer"}
Implement `RingBuffer<T, N>` with N a power of two, indices masked with `N - 1`, `push`, `pop`, `front`, `full` and `empty`. Decide whether it holds N or N−1 elements and justify.
::hint
If empty is `head == tail`, a full buffer can't also be `head == tail`, so you hold N−1; or use free-running counters and compare `tail - head == N` to hold N.
:::

:::exercise{#E5 level=interview-hard title="Price levels"}
Implement the bid side of a book three ways: `std::map<int64_t, Level, std::greater<>>`, a sorted vector with the best price at the back, and an array indexed by tick offset with a moving window. Feed each a stream where 90% of updates hit the top 5 levels and measure per-update latency.
::hint
The sorted vector with the best price at the back makes top-of-book inserts and deletes O(1) amortized.
:::
