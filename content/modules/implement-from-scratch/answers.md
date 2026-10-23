## Common pitfalls by problem

- **1:** Constructing elements with `new T[]` (default-constructs everything); forgetting to destroy elements before freeing; on growth, moving elements with a throwing move (breaks the strong guarantee; use `move_if_noexcept` and roll back on failure); not handling `push_back(v[0])` (construct the new element before destroying the old buffer); off-by-one in `capacity` growth from 0.
- **2:** Using a union without tracking which member is active; forgetting the null terminator in the inline buffer; moving an inline string by stealing a pointer to the other object's internal buffer (dangles); quadratic behavior from growing by exact size.
- **3:** Non-atomic counts; deleting the control block before the object (or while weak references exist); a `make_shared` that allocates twice; self-assignment releasing the last reference before acquiring the new one.
- **4:** Copying the wrong way (copying the buffer bytes instead of calling the stored type's copy constructor); not destroying the stored callable; alignment of the small buffer; storing non-copyable callables in a copyable wrapper.
- **5:** Accessing the value when disengaged; assigning to a disengaged optional with `operator=` on uninitialized storage (must construct instead); forgetting to destroy on `reset` and in the destructor.
- **6:** Marking erased slots empty (breaks probe chains for later keys); infinite loops when the table is full; poor hashes for sequential keys (mix with a multiplicative or `splitmix64`-style hash); not rehashing tombstones.
- **7:** Storing iterators into a `std::vector` (invalidated); evicting from the map but not the list (or vice versa); O(n) recency updates instead of `list::splice`.
- **8:** Returning raw storage without constructing; double release corrupting the free list; alignment of the slot storage.
- **9:** Relaxed orders (no protection of the critical section); spinning with `exchange` instead of a relaxed load (cache-line ping-pong); no pause instruction.
- **10:** Exceptions escaping a worker thread (terminates the program; wrap tasks in `packaged_task`); shutdown that deadlocks because workers never wake; lost wakeups from notifying without holding the lock while changing state.
- **11:** Wrong memory orders; releasing the slot before reading it in `pop`; using it with two producers.
- **12:** `double` prices; O(n) cancel by scanning a level; not removing empty levels (wrong BBO); `std::map` per level holding `std::list` with allocations on every message.
- **13:** Filling at the incoming order's price instead of the resting price; executing part of an FOK before checking; letting a size increase keep priority.
- **14:** Floating-point drift; refilling beyond capacity; unsigned underflow when time goes backward.
- **15:** Erasing a node that isn't linked; forgetting to null the hooks on erase; the object being destroyed while still in a list.
- **16:** `int32_t` overflow in the price-volume sum; recomputing the whole window each query (O(n)); evicting with the wrong comparison at the boundary.

## Reference solution: SPSC queue

Compiled and run clean under ThreadSanitizer, AddressSanitizer and UBSan (GCC 13, 5M items, order checked).

```cpp kind=fragment run=local
template <class T, std::size_t N>
class SpscQueue {
    static_assert(N >= 2 && (N & (N - 1)) == 0, "N must be a power of two");
    static constexpr std::size_t kLine = 128;  // covers x86 adjacent-line prefetch and 128-byte-line ARM cores (Apple Silicon)
    alignas(kLine) std::atomic<std::size_t> head_{0};  // written by consumer
    alignas(kLine) std::size_t tail_cache_ = 0;        // consumer's copy of tail
    alignas(kLine) std::atomic<std::size_t> tail_{0};  // written by producer
    alignas(kLine) std::size_t head_cache_ = 0;        // producer's copy of head
    alignas(kLine) T buf_[N];
public:
    bool try_push(const T& v) {
        const auto t = tail_.load(std::memory_order_relaxed);
        if (t - head_cache_ == N) {
            head_cache_ = head_.load(std::memory_order_acquire);
            if (t - head_cache_ == N) return false;     // full
        }
        buf_[t & (N - 1)] = v;
        tail_.store(t + 1, std::memory_order_release);  // publish the slot
        return true;
    }
    std::optional<T> try_pop() {
        const auto h = head_.load(std::memory_order_relaxed);
        if (h == tail_cache_) {
            tail_cache_ = tail_.load(std::memory_order_acquire);
            if (h == tail_cache_) return std::nullopt;  // empty
        }
        T v = buf_[h & (N - 1)];
        head_.store(h + 1, std::memory_order_release);  // hand the slot back
        return v;
    }
};
```

Why each order: each side reads its own index relaxed (only it writes that index). The acquire load of the other side's index pairs with that side's release store, so the producer sees slots the consumer has finished reading, and the consumer sees slot contents the producer wrote. Free-running indices make all N slots usable. Limitations to mention: `T` must be default-constructible and copyable here; a production version would use raw storage and move semantics.

## Reference solution: LRU cache

Compiled and run clean under ASan and UBSan on GCC 13 and Clang 18.

```cpp kind=fragment run=local
template <class K, class V>
class LruCache {
    using Entry = std::pair<K, V>;
    std::size_t cap_;
    std::list<Entry> items_;  // front = most recently used
    std::unordered_map<K, typename std::list<Entry>::iterator> index_;
public:
    explicit LruCache(std::size_t cap) : cap_(cap) { assert(cap > 0); }
    std::optional<V> get(const K& k) {
        auto it = index_.find(k);
        if (it == index_.end()) return std::nullopt;
        items_.splice(items_.begin(), items_, it->second);  // O(1), iterators stay valid
        return it->second->second;
    }
    void put(const K& k, V v) {
        if (auto it = index_.find(k); it != index_.end()) {
            it->second->second = std::move(v);
            items_.splice(items_.begin(), items_, it->second);
            return;
        }
        if (items_.size() == cap_) {
            index_.erase(items_.back().first);
            items_.pop_back();
        }
        items_.emplace_front(k, std::move(v));
        index_.emplace(k, items_.begin());
    }
};
```

Why it works: `std::list` iterators stay valid across `splice`, so the map can hold them. Follow-up answer for low latency: replace the list and map with a preallocated node array, an intrusive list of indices, and an open-addressing map, so steady-state operations never allocate.

## Follow-up answers in brief

- **Vector growth:** geometric growth (1.5–2×) gives amortized O(1); see :mod[containers].
- **SSO layout:** libc++ uses one bit to choose between a long layout (pointer, size, capacity) and a short layout where the remaining bytes hold characters and the size, fitting 22 characters plus a terminator in 24 bytes.
- **Hash map deletion:** backward-shift deletion moves later entries in the same probe chain back one slot, so no tombstones accumulate.
- **Thread-safe LRU:** a single mutex works but serializes; shard by key hash into independent caches, or use approximate LRU (sampling, clock algorithm) to avoid touching shared recency state on every read.
- **Token bucket at scale:** store `(tokens, last_refill_time)` per key and refill lazily on access; evict idle keys.
