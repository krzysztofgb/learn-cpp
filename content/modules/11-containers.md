# Module 11: Containers

Container choice dominates the performance of most C++ systems, and invalidation rules are a reliable source of UB questions. Know the big-O, and also know that cache behavior often beats big-O for the sizes trading systems use.

## Notes

### 11.1 Complexity and layout at a glance

| Container | Layout | Lookup | Insert / erase | Iterators invalidated by insert |
| --- | --- | --- | --- | --- |
| `vector` | Contiguous | O(1) index | End: amortized O(1); middle: O(n) | All, if reallocation; else at/after the point |
| `deque` | Fixed-size blocks + index | O(1) index | Ends: O(1); middle: O(n) | All iterators (references survive at the ends) |
| `list` | Doubly linked nodes | O(n) | O(1) given an iterator | None |
| `array` | Inline, fixed size | O(1) | n/a | n/a |
| `map`/`set` | Red-black tree nodes | O(log n) | O(log n) | None |
| `unordered_map` | Bucket array of node chains | O(1) average | O(1) average | All, if rehash (references survive) |
| `flat_map` (C++23) | Two sorted vectors | O(log n), cache-friendly | O(n) | All |

### 11.2 `vector`

- Growth is geometric so `push_back` is amortized O(1). libstdc++ and libc++ grow by 2×, MSVC by 1.5× (a factor below the golden ratio lets freed blocks eventually be reused).
- `reserve(n)` sets capacity without creating elements; `resize(n)` creates them. Indexing past `size()` is UB even within capacity.
- `clear()` keeps the capacity; `shrink_to_fit()` is a non-binding request.
- `emplace_back` constructs in place from constructor arguments; `push_back` takes an object. `emplace_back` can call `explicit` constructors, which is occasionally a trap.
- `v.push_back(v[0])` works even if it reallocates. No sentence in the standard says so explicitly; the committee's reading (LWG issues 526 and 2164) is that it must work because nothing permits it to fail, and libstdc++, libc++ and MSVC all construct the new element before releasing old storage. Boost.Container deliberately treats it as UB.
- `vector<bool>` is a bit-packed specialization whose `operator[]` returns a proxy object, not a `bool&`. It isn't a real container of `bool`.

### 11.3 Strings

`std::string` stores short strings inline (small-string optimization, SSO): up to 22 characters in libc++ (24-byte object) and 15 in libstdc++ (32-byte object). Longer strings allocate. `std::string_view` is a pointer plus length: it doesn't own, isn't necessarily null-terminated, and dangles if the string it views dies or reallocates.

### 11.4 Associative containers

- `map::operator[]` inserts a default-constructed value if the key is missing; use `find`, `contains` (C++20) or `at` to look up without inserting.
- `try_emplace` and `insert_or_assign` (C++17) avoid constructing values unnecessarily; `extract` moves nodes between maps without reallocation.
- The comparator must be a strict weak ordering (Module 12); `std::less_equal` violates it, which is UB.
- `unordered_map`'s interface (stable references, bucket API) effectively forces node-based chaining: one allocation per element and a pointer chase per lookup. Open-addressing tables such as `absl::flat_hash_map` or `boost::unordered_flat_map` are typically several times faster. A poor hash function degrades any hash table to O(n).

### 11.5 Views and fixed-capacity types

- `std::span<T>` (C++20): non-owning view of contiguous memory, with static or dynamic extent. The standard way to pass arrays to functions.
- `std::mdspan` (C++23): multidimensional view with configurable layout.
- `std::inplace_vector<T, N>` (C++26): a vector with fixed capacity stored inline, never allocates; great for small bounded lists on hot paths.
- Adaptors: `stack`, `queue`, `priority_queue` (a binary heap over a `vector`).

### 11.6 Choosing for an order book

Price levels change constantly near the top of the book and rarely far from it. Common designs: a `std::map<Price, Level>` (simple, O(log n), pointer chasing); a sorted `vector` of levels with the best price at the back (inserts near the top are cheap); or an array indexed by price offset from a reference price (O(1), needs bounded price range and recentering). Real systems benchmark these against realistic message streams.

## Predict the output

**P1**

```cpp kind=fragment run=local
std::map<std::string, int> m;
if (m["a"] == 0) {}
cout << m.size();
m.find("b");
cout << m.size();
m.count("c");
cout << m.size();
```

**P2**

```cpp kind=fragment run=local
std::vector<bool> v{true, false};
auto x = v[0];
v[0] = false;
cout << x;
```

**P3**

```cpp kind=fragment run=local
std::string s = "hello world";
std::string_view sv(s.data(), 5);
cout << sv << '|' << sv.data();
```

**P4**

```cpp kind=fragment run=local
std::vector<std::vector<int>> v;
v.emplace_back(3);
v.push_back({3});
cout << v[0].size() << ' ' << v[1].size();
```

**P5**

```cpp kind=fragment run=local
std::vector<int> v{1, 2, 3, 2, 5};
std::remove(v.begin(), v.end(), 2);
cout << v.size() << ' ';
auto n = std::erase(v, 2);
cout << v.size() << ' ' << n;
```

**P6**

```cpp kind=fragment run=local note="In the browser this is wasm32, where `long` and pointers are 32-bit, so std::string is 12 bytes here."
cout << sizeof(std::string);   // on libc++ and on libstdc++
```

## Spot the UB

**U1**

```cpp kind=fragment run=local
std::vector<int> v;
v.reserve(10);
v[0] = 1;
```

**U2**

```cpp kind=fragment run=none
for (auto it = v.begin(); it != v.end(); ++it)
    if (*it % 2) v.erase(it);
```

**U3**

```cpp kind=fragment run=none
int& first = v[0];
v.push_back(42);
++first;
```

**U4**

```cpp kind=fragment run=local
std::vector<int> v{1, 2, 3};
v.push_back(v[0]);
```

**U5**

```cpp kind=fragment run=local
std::string_view venue() { return std::string("XNAS"); }
```

**U6**

```cpp kind=fragment run=local
std::set<int, std::less_equal<int>> s{3, 1, 3};
```

## Exercises

**E1 ★ Invalidation lab.** For `vector`, `deque`, `list`, `map` and `unordered_map`, write a test per invalidation rule that holds an iterator and a reference across an insert and an erase. Run under ASan and record which accesses it flags.

**E2 ★★ `Vector<T>`.** Implement a vector without allocator support: `push_back`, `emplace_back`, `pop_back`, `reserve`, `resize`, `erase`, iterators, copy and move. Grow with `std::move_if_noexcept` and `std::uninitialized_*` algorithms so reallocation gives the strong guarantee. (Module 28 revisits this under interview time pressure.)

**E3 ★★ Lookup benchmark.** For 1K, 100K and 10M random `int64_t` keys, time lookups and full iteration in `std::map`, `std::unordered_map`, a sorted `vector` with `lower_bound`, and `std::flat_map` (or Boost's). Explain the crossover points.

**E4 ★★ Ring buffer.** Implement `RingBuffer<T, N>` with N a power of two, indices masked with `N - 1`, `push`, `pop`, `front`, `full` and `empty`. Decide whether it holds N or N−1 elements and justify.

**E5 ★★★ Price levels.** Implement the bid side of a book three ways: `std::map<int64_t, Level, std::greater<>>`, a sorted vector with the best price at the back, and an array indexed by tick offset with a moving window. Feed each a stream where 90% of updates hit the top 5 levels and measure per-update latency.

## Interview questions

1. How does `vector` growth work, and why is `push_back` amortized O(1)?
2. Why might a growth factor of 1.5 be preferred over 2?
3. When are `vector` iterators and references invalidated?
4. `map` vs `unordered_map`: when do you choose each?
5. How is `std::unordered_map` implemented, and why is it often slow?
6. What is the small-string optimization?
7. What are the pitfalls of `std::string_view`?
8. What's wrong with `vector<bool>`?
9. `emplace_back` vs `push_back`?
10. How would you store price levels in an order book?
11. Is `v.push_back(v[0])` safe?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `111` | Only `operator[]` inserts. |
| P2 | `0` | `x` is a `vector<bool>::reference` proxy, not a copy of the bool. |
| P3 | `hello\|hello world` | `sv.data()` points into `s`; the view's length isn't a terminator. |
| P4 | `3 1` | `emplace_back(3)` calls `vector<int>(3)`; `push_back({3})` builds `{3}` from an initializer list. |
| P5 | `5` then unspecified (`4 1` in practice) | `remove` shifts kept elements forward (`1 3 5`) but doesn't change size; the tail is unspecified. libc++ and libstdc++ leave the original `2 5` there, so `std::erase` then finds and removes one 2. |
| P6 | `24` on libc++, `32` on libstdc++ | Different SSO layouts. |

### Spot the UB

- **U1:** UB: `size()` is 0, so `v[0]` is out of range despite capacity. Use `push_back` or `resize`.
- **U2:** UB: `erase` invalidates `it`, then `++it` uses it. Write `it = v.erase(it);` and only increment otherwise, or use `std::erase_if(v, pred)`.
- **U3:** UB if `push_back` reallocated: `first` dangles.
- **U4:** No UB for std::vector: the standard has no rule forbidding it, and the committee's position (LWG 526, LWG 2164) is that it must work. Not every vector-like container agrees; Boost.Container calls it UB.
- **U5:** UB on use: the view outlives the temporary string. Return `std::string`, or a view of something with static storage (`return "XNAS";` works).
- **U6:** UB: `less_equal` isn't a strict weak ordering (`a <= a` is true), so the set's invariants break.

### Exercise hints

- **E3:** Sorted vectors usually win for read-heavy workloads at all sizes because of contiguity; hash maps win on random lookups at large sizes; `std::map` rarely wins anything except stable iterators and ordered mutation.
- **E4:** If empty is `head == tail`, a full buffer can't also be `head == tail`, so you hold N−1; or use free-running counters and compare `tail - head == N` to hold N.
- **E5:** The sorted vector with the best price at the back makes top-of-book inserts and deletes O(1) amortized.

### Interview questions

1. When full, allocate a larger block (geometric growth), move elements, free the old block. Total copying over n pushes is O(n), so O(1) amortized.
2. With 2×, the sum of all previously freed blocks is always smaller than the next request, so the allocator can never reuse them; below the golden ratio, it eventually can.
3. Reallocation (insert beyond capacity, `reserve`, `shrink_to_fit`) invalidates all of them. Otherwise insert and erase invalidate everything at or after the point.
4. `unordered_map` for fast average lookups with no ordering. `map` when you need ordering, range queries, stable iterators, or worst-case guarantees.
5. Separate chaining: an array of buckets, each a linked list of individually allocated nodes. Every lookup chases pointers; every insert allocates.
6. Strings up to a small length are stored inside the string object, avoiding heap allocation.
7. It doesn't own: it dangles when the source dies or reallocates. It isn't null-terminated, so passing `.data()` to C APIs is a bug.
8. It's packed bits with a proxy reference, so it doesn't satisfy container requirements: `auto x = v[0]` isn't a bool, you can't take `&v[0]` as `bool*`, and concurrent writes to different elements race.
9. `emplace_back` constructs from constructor arguments in place; `push_back` copies or moves an existing object. With an existing object they're equivalent; `emplace_back` can unintentionally call `explicit` constructors.
10. Depends on access patterns: a sorted vector or array indexed by tick offset for hot levels, possibly with a map for far levels. Mention cache locality, no per-update allocation, and fast best-price access.
11. Yes for std::vector. The standard doesn't forbid aliasing a const reference argument, and the committee has said (LWG 526, LWG 2164) that this means it must work; implementations construct the new element before freeing old storage. Mention that it's an interpretation, not an explicit rule, and that other libraries (Boost.Container) differ.
