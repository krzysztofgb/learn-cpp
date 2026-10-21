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

As in :mod[smart-pointers] exercises E2 and E3, but under time pressure. `SharedPtr` needs copy, move, `reset`, `use_count`, `get`, and a `make_shared` with a single allocation. **Tests:** counting type for leaks; 8 threads copying and dropping one pointer under TSan. **Follow-ups:** why the decrement needs acq\_rel; how `weak_ptr` changes the control block; the aliasing constructor.

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

`add(id, side, price, qty)`, `cancel(id)`, `modify(id, new_qty)`, `execute(id, qty)`, `best_bid()`, `best_ask()`, and quantity at a price. Integer prices in ticks. **Tests:** add and cancel at the same level, cancel of the best level updates the BBO, partial executes, unknown IDs. **Follow-ups:** O(1) cancel (intrusive lists plus ID map); level storage choices (:mod[containers]); memory layout for speed (:mod[low-latency-techniques]).

### 13. Matching engine

On top of a book: incoming limit and market orders match with price-time priority, producing fill events; support IOC and FOK; cancel; modify with correct priority rules (:mod[trading-domain]). **Tests:** a sweep across several levels, partial fill then rest, FOK that can't fully fill, modify up loses priority, modify down keeps it. **Follow-ups:** self-trade prevention; pro-rata; making fills allocation-free.

### 14. Token-bucket rate limiter

`allow(now)` returns whether an action is permitted given a rate and burst capacity. O(1), no background thread. **Tests:** burst then sustained rate; long idle refills only up to capacity; time going backwards. **Follow-ups:** millions of clients (lazy refill per key, eviction); sliding-window alternatives; using integer nanoseconds rather than `double`.

### 15. Intrusive doubly linked list

Nodes embed `prev`/`next` hooks; `push_back(T&)`, `erase(T&)` in O(1) without searching, iteration. The list doesn't own nodes. **Tests:** erase head, tail and middle; an object in two lists via two hooks. **Follow-ups:** why this beats `std::list<T*>` (no allocation, one fewer indirection, O(1) erase from the object itself); safe-mode hooks that detect double insertion.

### 16. Sliding-window VWAP

Stream of trades `(timestamp_ns, price_ticks, qty)`; `vwap(now)` returns the volume-weighted average price over the last 5 seconds. Amortized O(1) per trade. **Tests:** window boundaries (inclusive or exclusive, stated), no trades in window, out-of-order timestamps rejected. **Follow-ups:** overflow in `price × qty`; fixed memory (ring buffer); percentiles over a window.
