:::question{#Q1}
How does `vector` growth work, and why is `push_back` amortized O(1)?
::answer
When full, allocate a larger block (geometric growth), move elements, free the old block. Total copying over n pushes is O(n), so O(1) amortized.
:::

:::question{#Q2}
Why might a growth factor of :sec[types-and-initialization/floating-point-in-one-paragraph] be preferred over 2?
::answer
With 2×, the sum of all previously freed blocks is always smaller than the next request, so the allocator can never reuse them; below the golden ratio, it eventually can.
:::

:::question{#Q3}
When are `vector` iterators and references invalidated?
::answer
Reallocation (insert beyond capacity, `reserve`, `shrink_to_fit`) invalidates all of them. Otherwise insert and erase invalidate everything at or after the point.
:::

:::question{#Q4}
`map` vs `unordered_map`: when do you choose each?
::answer
`unordered_map` for fast average lookups with no ordering. `map` when you need ordering, range queries, stable iterators, or worst-case guarantees.
:::

:::question{#Q5}
How is `std::unordered_map` implemented, and why is it often slow?
::answer
Separate chaining: an array of buckets, each a linked list of individually allocated nodes. Every lookup chases pointers; every insert allocates.
:::

:::question{#Q6}
What is the small-string optimization?
::answer
Strings up to a small length are stored inside the string object, avoiding heap allocation.
:::

:::question{#Q7}
What are the pitfalls of `std::string_view`?
::answer
It doesn't own: it dangles when the source dies or reallocates. It isn't null-terminated, so passing `.data()` to C APIs is a bug.
:::

:::question{#Q8}
What's wrong with `vector<bool>`?
::answer
It's packed bits with a proxy reference, so it doesn't satisfy container requirements: `auto x = v[0]` isn't a bool, you can't take `&v[0]` as `bool*`, and concurrent writes to different elements race.
:::

:::question{#Q9}
`emplace_back` vs `push_back`?
::answer
`emplace_back` constructs from constructor arguments in place; `push_back` copies or moves an existing object. With an existing object they're equivalent; `emplace_back` can unintentionally call `explicit` constructors.
:::

:::question{#Q10}
How would you store price levels in an order book?
::answer
Depends on access patterns: a sorted vector or array indexed by tick offset for hot levels, possibly with a map for far levels. Mention cache locality, no per-update allocation, and fast best-price access.
:::

:::question{#Q11}
Is `v.push_back(v[0])` safe?
::answer
Yes for std::vector. The standard doesn't forbid aliasing a const reference argument, and the committee has said (LWG 526, LWG 2164) that this means it must work; implementations construct the new element before freeing old storage. Mention that it's an interpretation, not an explicit rule, and that other libraries (Boost.Container) differ.
:::
