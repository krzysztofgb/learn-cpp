### Complexity and layout at a glance

| Container | Layout | Lookup | Insert / erase | Iterators invalidated by insert |
| --- | --- | --- | --- | --- |
| `vector` | Contiguous | O(1) index | End: amortized O(1); middle: O(n) | All, if reallocation; else at/after the point |
| `deque` | Fixed-size blocks + index | O(1) index | Ends: O(1); middle: O(n) | All iterators (references survive at the ends) |
| `list` | Doubly linked nodes | O(n) | O(1) given an iterator | None |
| `array` | Inline, fixed size | O(1) | n/a | n/a |
| `map`/`set` | Red-black tree nodes | O(log n) | O(log n) | None |
| `unordered_map` | Bucket array of node chains | O(1) average | O(1) average | All, if rehash (references survive) |
| `flat_map` (C++23) | Two sorted vectors | O(log n), cache-friendly | O(n) | All |

### `vector`

- Growth is geometric so `push_back` is amortized O(1). libstdc++ and libc++ grow by 2×, MSVC by 1.5× (a factor below the golden ratio lets freed blocks eventually be reused).
- `reserve(n)` sets capacity without creating elements; `resize(n)` creates them. Indexing past `size()` is UB even within capacity.
- `clear()` keeps the capacity; `shrink_to_fit()` is a non-binding request.
- `emplace_back` constructs in place from constructor arguments; `push_back` takes an object. `emplace_back` can call `explicit` constructors, which is occasionally a trap.
- `v.push_back(v[0])` works even if it reallocates. No sentence in the standard says so explicitly; the committee's reading (LWG issues 526 and 2164) is that it must work because nothing permits it to fail, and libstdc++, libc++ and MSVC all construct the new element before releasing old storage. Boost.Container deliberately treats it as UB.
- `vector<bool>` is a bit-packed specialization whose `operator[]` returns a proxy object, not a `bool&`. It isn't a real container of `bool`.

### Strings

`std::string` stores short strings inline (small-string optimization, SSO): up to 22 characters in libc++ (24-byte object) and 15 in libstdc++ (32-byte object). Longer strings allocate. `std::string_view` is a pointer plus length: it doesn't own, isn't necessarily null-terminated, and dangles if the string it views dies or reallocates.

### Associative containers

- `map::operator[]` inserts a default-constructed value if the key is missing; use `find`, `contains` (C++20) or `at` to look up without inserting.
- `try_emplace` and `insert_or_assign` (C++17) avoid constructing values unnecessarily; `extract` moves nodes between maps without reallocation.
- The comparator must be a strict weak ordering (:mod[algorithms-and-ranges]); `std::less_equal` violates it, which is UB.
- `unordered_map`'s interface (stable references, bucket API) effectively forces node-based chaining: one allocation per element and a pointer chase per lookup. Open-addressing tables such as `absl::flat_hash_map` or `boost::unordered_flat_map` are typically several times faster. A poor hash function degrades any hash table to O(n).

### Views and fixed-capacity types

- `std::span<T>` (C++20): non-owning view of contiguous memory, with static or dynamic extent. The standard way to pass arrays to functions.
- `std::mdspan` (C++23): multidimensional view with configurable layout.
- `std::inplace_vector<T, N>` (C++26): a vector with fixed capacity stored inline, never allocates; great for small bounded lists on hot paths.
- Adaptors: `stack`, `queue`, `priority_queue` (a binary heap over a `vector`).

### Choosing for an order book

Price levels change constantly near the top of the book and rarely far from it. Common designs: a `std::map<Price, Level>` (simple, O(log n), pointer chasing); a sorted `vector` of levels with the best price at the back (inserts near the top are cheap); or an array indexed by price offset from a reference price (O(1), needs bounded price range and recentering). Real systems benchmark these against realistic message streams.
