# Module 28: Implement from scratch

These are the coding problems low-latency C++ interview loops actually use. Each one tests the same three things: correct C++ (lifetimes, exception safety, no UB), sensible data structure choices, and how you talk about performance. Practice each under a timer, in a plain editor, then compile with `-Wall -Wextra -fsanitize=address,undefined` (and `-fsanitize=thread` for concurrent ones) and run your tests.

## How to practice

1. Read the spec, then state your design and its complexity out loud before writing code, as you would in the interview.
2. Write it in the time shown. Interviewers care more about a correct core and clear trade-offs than every feature.
3. Write the listed tests, run them under sanitizers, and fix what breaks.
4. Answer the follow-ups aloud. Then compare with the pitfalls in the answer key.

| # | Problem | Time | Most likely follow-up |
| --- | --- | --- | --- |
| 1 | `Vector<T>` | 45 min | Exception safety during growth |
| 2 | String with SSO | 40 min | Layout tricks to fit 22 chars in 24 bytes |
| 3 | `UniquePtr` and `SharedPtr` | 30 + 45 min | Memory orders on the refcount |
| 4 | `Function<R(Args...)>` | 45 min | Small-buffer optimization |
| 5 | `Optional<T>` | 30 min | Trivially destructible when `T` is |
| 6 | Open-addressing hash map | 45 min | Deletion without tombstone buildup |
| 7 | LRU cache | 25 min | Thread safety, avoiding allocation |
| 8 | Fixed-size object pool | 25 min | Thread-safe version |
| 9 | Spinlock | 15 min | Memory orders, backoff |
| 10 | Thread pool | 40 min | Shutdown, futures, work stealing |
| 11 | SPSC queue | 30 min | Making it faster |
| 12 | Limit order book | 60 min | Cancel in O(1) |
| 13 | Matching engine | 60 min | IOC/FOK, modify priority |
| 14 | Token-bucket rate limiter | 20 min | Per-client limits at scale |
| 15 | Intrusive doubly linked list | 25 min | Why intrusive beats `std::list` |
| 16 | Sliding-window VWAP | 25 min | Time-based vs count-based windows |

## The problems

### 1. `Vector<T>`

Implement `push_back` (copy and move), `emplace_back`, `pop_back`, `operator[]`, `at`, `size`, `capacity`, `reserve`, `resize`, `clear`, iterators, copy and move constructors and assignment, and a destructor. Use raw uninitialized storage (`std::allocator<T>` or `operator new`), not `new T[]`. **Tests:** a type that counts live instances (to catch leaks and double destruction), a type whose copy throws on the Nth call (strong guarantee on growth), a move-only type, self-assignment. **Follow-ups:** growth factor choice; why `push_back(v[0])` must work; `std::move_if_noexcept`.

### 2. String with small-string optimization

A `String` that stores up to 15 (or 22) characters inline and allocates beyond that: constructors from `const char*`, copy, move, `size`, `c_str`, `operator+=`, `operator[]`. **Tests:** transitions across the inline limit both ways via `+=` and assignment; moving an inline string vs a heap string. **Follow-ups:** how libc++ fits 22 characters plus size in 24 bytes; why moving an SSO string copies bytes.

### 3. `UniquePtr` and `SharedPtr`

As in Module 9 exercises E2 and E3, but under time pressure. `SharedPtr` needs copy, move, `reset`, `use_count`, `get`, and a `make_shared` with a single allocation. **Tests:** counting type for leaks; 8 threads copying and dropping one pointer under TSan. **Follow-ups:** why the decrement needs acq\_rel; how `weak_ptr` changes the control block; the aliasing constructor.

### 4. `Function<R(Args...)>`

Type-erased callable: construct from any callable, copy, move, call, empty check. Start with heap storage, then add a small buffer (e.g. 32 bytes) for small callables. **Tests:** lambdas with large and small captures, function pointers, a stateful functor counting copies, calling an empty one. **Follow-ups:** the manual vtable vs virtual base class design; what `std::function_ref` and `move_only_function` change.

### 5. `Optional<T>`

Storage plus an engaged flag; `emplace`, `reset`, `has_value`, `value` (throws), `operator*`, `operator->`, copy and move. **Tests:** counting type; a type without a default constructor. **Follow-ups:** making `Optional<int>` trivially copyable and destructible; `Optional<T&>`.

### 6. Open-addressing hash map

`int64_t` keys to `V`, linear probing, power-of-two capacity, resize above a load factor (e.g. 0.7), `insert`, `find`, `erase`. **Tests:** colliding keys, erase in the middle of a probe chain followed by `find` of a later key, growth during inserts, randomized comparison against `std::unordered_map`. **Follow-ups:** tombstones vs backward-shift deletion; Robin Hood hashing; why it beats `std::unordered_map`; choosing a hash for sequential order IDs.

### 7. LRU cache

`get(key)` returns the value and marks it most recently used; `put(key, value)` inserts or updates, evicting the least recently used when full. Both O(1). **Tests:** eviction order, update of an existing key, capacity 1. **Follow-ups:** making it thread-safe (and the contention problem); avoiding a per-insert allocation; what changes for LFU.

### 8. Fixed-size object pool

`Pool<T, N>` with `acquire(args...)` returning `T*` (or null when exhausted) and `release(T*)`, O(1), no allocation after construction, objects constructed with placement new and destroyed on release. **Tests:** exhaust and refill; counting type; release of every object in random order. **Follow-ups:** thread-safe version (lock-free free list and ABA); returning a `unique_ptr` with a custom deleter.

### 9. Spinlock

`lock`, `try_lock`, `unlock` meeting the Lockable requirements (so it works with `std::lock_guard`). Test-and-test-and-set with a pause instruction. **Tests:** 8 threads incrementing a plain counter under the lock, checked under TSan. **Follow-ups:** memory orders; backoff; when a spinlock is a bad idea; ticket locks for fairness.

### 10. Thread pool

Fixed N workers, `submit(f, args...)` returning `std::future<R>`, graceful shutdown that finishes queued tasks. **Tests:** many small tasks; a task that throws (the exception must reach `future::get`); destruction while tasks are queued. **Follow-ups:** work stealing; a task waiting on another task (deadlock); bounded queues and back-pressure.

### 11. SPSC queue

Bounded, lock-free, one producer and one consumer, `try_push` and `try_pop`. **Tests:** a producer sending 0..N-1 and a consumer asserting it receives them in order, under TSan. **Follow-ups:** justify every memory order; cached indices; padding; batching; why exactly one producer.

### 12. Limit order book

`add(id, side, price, qty)`, `cancel(id)`, `modify(id, new_qty)`, `execute(id, qty)`, `best_bid()`, `best_ask()`, and quantity at a price. Integer prices in ticks. **Tests:** add and cancel at the same level, cancel of the best level updates the BBO, partial executes, unknown IDs. **Follow-ups:** O(1) cancel (intrusive lists plus ID map); level storage choices (Module 11); memory layout for speed (Module 22).

### 13. Matching engine

On top of a book: incoming limit and market orders match with price-time priority, producing fill events; support IOC and FOK; cancel; modify with correct priority rules (Module 26). **Tests:** a sweep across several levels, partial fill then rest, FOK that can't fully fill, modify up loses priority, modify down keeps it. **Follow-ups:** self-trade prevention; pro-rata; making fills allocation-free.

### 14. Token-bucket rate limiter

`allow(now)` returns whether an action is permitted given a rate and burst capacity. O(1), no background thread. **Tests:** burst then sustained rate; long idle refills only up to capacity; time going backwards. **Follow-ups:** millions of clients (lazy refill per key, eviction); sliding-window alternatives; using integer nanoseconds rather than `double`.

### 15. Intrusive doubly linked list

Nodes embed `prev`/`next` hooks; `push_back(T&)`, `erase(T&)` in O(1) without searching, iteration. The list doesn't own nodes. **Tests:** erase head, tail and middle; an object in two lists via two hooks. **Follow-ups:** why this beats `std::list<T*>` (no allocation, one fewer indirection, O(1) erase from the object itself); safe-mode hooks that detect double insertion.

### 16. Sliding-window VWAP

Stream of trades `(timestamp_ns, price_ticks, qty)`; `vwap(now)` returns the volume-weighted average price over the last 5 seconds. Amortized O(1) per trade. **Tests:** window boundaries (inclusive or exclusive, stated), no trades in window, out-of-order timestamps rejected. **Follow-ups:** overflow in `price × qty`; fixed memory (ring buffer); percentiles over a window.

## Answer key

### Common pitfalls by problem

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

### Reference solution: SPSC queue

Compiled and run clean under ThreadSanitizer, AddressSanitizer and UBSan (GCC 13, 5M items, order checked).

```cpp kind=fragment run=local
template <class T, std::size_t N>
class SpscQueue {
    static_assert(N >= 2 && (N & (N - 1)) == 0, "N must be a power of two");
    static constexpr std::size_t kLine = 128;  // safe on x86 and Apple M-series
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

### Reference solution: LRU cache

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

### Follow-up answers in brief

- **Vector growth:** geometric growth (1.5–2×) gives amortized O(1); see Module 11.
- **SSO layout:** libc++ uses one bit to choose between a long layout (pointer, size, capacity) and a short layout where the remaining bytes hold characters and the size, fitting 22 characters plus a terminator in 24 bytes.
- **Hash map deletion:** backward-shift deletion moves later entries in the same probe chain back one slot, so no tombstones accumulate.
- **Thread-safe LRU:** a single mutex works but serializes; shard by key hash into independent caches, or use approximate LRU (sampling, clock algorithm) to avoid touching shared recency state on every read.
- **Token bucket at scale:** store `(tokens, last_refill_time)` per key and refill lazily on access; evict idle keys.
