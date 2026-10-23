### Complexity and layout at a glance

| Container | Layout | Lookup | Insert / erase | Invalidated by insert | Invalidated by erase |
| --- | --- | --- | --- | --- | --- |
| `vector` | Contiguous | O(1) index | End: amortized O(1); middle: O(n) | All, if reallocation; else at/after the point | At/after the point, including `end()` |
| `deque` | Fixed-size blocks + index | O(1) index | Ends: O(1); middle: O(n) | All iterators (references survive at the ends) | Middle: all. Ends: only the erased (and `end()` when erasing the back) |
| `list` | Doubly linked nodes | O(n) | O(1) given an iterator | None | Only the erased |
| `array` | Inline, fixed size | O(1) | n/a | n/a | n/a |
| `map`/`set` | Red-black tree nodes | O(log n) | O(log n) | None | Only the erased |
| `unordered_map` | Bucket array of node chains | O(1) average | O(1) average | All iterators, if rehash (references survive) | Only the erased |
| `flat_map` (C++23) | Two sorted vectors | O(log n), cache-friendly | O(n) | All | All |

Using an invalidated iterator, pointer or reference is UB, even if it still happens to point at valid memory. The member `erase` of every sequence and associative container returns an iterator to the element after the removed one, which is how you erase while looping: `it = c.erase(it);`, and advance only when you didn't erase.

*Further reading:* [STL containers overview](https://www.learncpp.com/cpp-tutorial/stl-containers-overview/), [Introduction to containers and arrays](https://www.learncpp.com/cpp-tutorial/introduction-to-containers-and-arrays/)

### `vector`

- Growth is geometric so `push_back` is amortized O(1): n pushes copy at most about n + n/2 + n/4 + … < 2n elements in total. libstdc++ and libc++ grow by 2×, MSVC by 1.5×. A factor below the golden ratio (≈1.618) lets freed blocks eventually be reused: with 2×, each new block (2ᵏ) is larger than all earlier blocks combined (2ᵏ − 1), so the allocator can never satisfy it from them.
- `reserve(n)` sets capacity without creating elements; `resize(n)` creates them. Indexing past `size()` is UB even within capacity.
- Reallocation happens on an insert beyond capacity and on `reserve` or `shrink_to_fit` that changes capacity; it invalidates every iterator, pointer and reference. Without reallocation, insert and erase invalidate only those at or after the point.
- `clear()` keeps the capacity; `shrink_to_fit()` is a non-binding request.
- To grow, a vector allocates the new block, constructs the elements there, then destroys the old ones. It moves them only if `T`'s move constructor is `noexcept` (or `T` can't be copied); otherwise it copies. That is what gives `push_back` the strong exception guarantee: if a copy throws, the old block is untouched. `std::move_if_noexcept` expresses that choice, and `std::uninitialized_move`, `std::uninitialized_copy` and `std::destroy` construct and destroy elements in raw memory (:mod[raw-memory]).
- `emplace_back(args...)` constructs the element in place as `T(args...)`, with parentheses; `push_back(x)` takes an object, and `push_back({args...})` copy-list-initializes one from the braces, which prefers an `initializer_list` constructor. So for `vector<vector<int>>`, `emplace_back(3)` adds a vector of three zeros and `push_back({3})` adds a vector holding `3`. `emplace_back` can call `explicit` constructors, which is occasionally a trap.
- `std::remove(first, last, x)` only shifts the kept elements forward and returns the new logical end; the size doesn't change, and the elements after the new end are valid but have unspecified values. C++20's `std::erase(v, x)` and `std::erase_if(v, pred)` remove and erase in one call and return the number of elements removed (:mod[algorithms-and-ranges]).
- `v.push_back(v[0])` works even if it reallocates. No sentence in the standard says so explicitly; the committee's reading (LWG issues 526 and 2164) is that it must work because nothing permits it to fail, and libstdc++, libc++ and MSVC all construct the new element before releasing old storage. Boost.Container deliberately treats it as UB.
- `vector<bool>` is a bit-packed specialization whose `operator[]` returns a proxy object (`vector<bool>::reference`) that refers to a bit inside the vector, not a `bool&`. `auto x = v[0];` deduces the proxy, so `x` changes when the vector does. `&v[0]` isn't a `bool*`, and because neighbouring elements share a byte, writing different elements from different threads is a data race: the usual guarantee that distinct elements of a container can be modified concurrently explicitly excludes `vector<bool>` \[container.requirements.dataraces\]. It isn't a real container of `bool`.

*Further reading:* [Introduction to std::vector and list constructors](https://www.learncpp.com/cpp-tutorial/introduction-to-stdvector-and-list-constructors/), [std::vector resizing and capacity](https://www.learncpp.com/cpp-tutorial/stdvector-resizing-and-capacity/), [std::vector and stack behavior](https://www.learncpp.com/cpp-tutorial/stdvector-and-stack-behavior/), [std::vector&lt;bool&gt;](https://www.learncpp.com/cpp-tutorial/stdvector-bool/), [std::move_if_noexcept](https://www.learncpp.com/cpp-tutorial/stdmove_if_noexcept/)

### Strings

`std::string` stores short strings inline (small-string optimization, SSO): up to 22 characters in libc++ (24-byte object) and 15 in libstdc++ (32-byte object). Longer strings allocate.

`std::string_view` is a pointer plus length: it doesn't own, isn't necessarily null-terminated, and dangles if the string it views dies or reallocates. Printing a view writes exactly `size()` characters, but `sv.data()` is a plain `const char*`: anything that treats it as a C string (`printf("%s")`, `<<` on the pointer, C APIs) reads up to the next `'\0'` in the underlying buffer, which may be past the view's end or missing entirely. A view of a string literal never dangles, because literals have static storage duration; a view of a `std::string` returned by value dies with that temporary at the end of the full-expression (:sec[object-lifetime/temporaries-and-lifetime-extension]).

*Further reading:* [Introduction to std::string](https://www.learncpp.com/cpp-tutorial/introduction-to-stdstring/), [std::string length and capacity](https://www.learncpp.com/cpp-tutorial/stdstring-length-and-capacity/), [Introduction to std::string_view](https://www.learncpp.com/cpp-tutorial/introduction-to-stdstring_view/), [std::string_view (part 2)](https://www.learncpp.com/cpp-tutorial/stdstring_view-part-2/)

### Associative containers

- `map::operator[]` inserts a value-initialized element if the key is missing (that's why it isn't available on a `const map`); use `find`, `contains` (C++20), `count` or `at` to look up without inserting.
- `try_emplace` and `insert_or_assign` (C++17) avoid constructing values unnecessarily; `extract` moves nodes between maps without reallocation.
- The comparator must be a strict weak ordering (:sec[algorithms-and-ranges/strict-weak-ordering]); `std::less_equal` violates it (`a <= a` is true, so an element is "less" than itself), which is UB. Ordered containers use the comparator for both ordering and equality: two keys are equivalent when neither is less than the other. For descending order, use `std::greater<>`.
- `map` gives ordered iteration, range queries (`lower_bound`), iterators and references that survive every insert and every erase of other elements, and O(log n) worst case. `unordered_map` gives faster average lookup and nothing else.
- `unordered_map`'s interface (stable references, bucket API) effectively forces node-based separate chaining: an array of buckets, each a linked list of individually allocated nodes. That costs one allocation per insert and a pointer chase per lookup. Open-addressing tables such as `absl::flat_hash_map` or `boost::unordered_flat_map` are typically several times faster. A poor hash function degrades any hash table to O(n).

*Further reading:* [STL containers overview](https://www.learncpp.com/cpp-tutorial/stl-containers-overview/)

### Views and fixed-capacity types

- `std::span<T>` (C++20): non-owning view of contiguous memory, with static or dynamic extent. The standard way to pass arrays to functions.
- `std::mdspan` (C++23): multidimensional view with configurable layout.
- `std::inplace_vector<T, N>` (C++26): a vector with fixed capacity stored inline, never allocates; great for small bounded lists on hot paths.
- Adaptors: `stack`, `queue`, `priority_queue` (a binary heap over a `vector`).
- Ring buffers (a fixed array used as a circular queue) aren't in the standard library but are everywhere in low-latency code. With a power-of-two capacity N, `i & (N - 1)` replaces the slower `i % N`. If both indices wrap into \[0, N) and empty means `head == tail`, then a full buffer looks the same as an empty one, so either one slot stays unused or you keep the indices as free-running unsigned counters (unsigned wraparound is well defined) and mask only when indexing. :sec[lock-free-programming/spsc-ring-buffer] builds the concurrent version.

*Further reading:* [Introduction to std::array](https://www.learncpp.com/cpp-tutorial/introduction-to-stdarray/)

### Choosing for an order book

Price levels change constantly near the top of the book and rarely far from it. Common designs: a `std::map<Price, Level>` (simple, O(log n), pointer chasing); a sorted `vector` of levels with the best price at the back (inserts near the top are cheap); or an array indexed by price offset from a reference price (O(1), needs bounded price range and recentering). Real systems benchmark these against realistic message streams.
