### `unique_ptr`

Exclusive ownership, move-only. With the default deleter it's exactly one pointer in size and compiles to the same code as a raw pointer plus `delete`.

- The deleter is part of the type: `std::unique_ptr<FILE, decltype(&std::fclose)>`. A function-pointer deleter doubles the size to 16 bytes; a stateless function object or captureless lambda stays at 8, thanks to the empty base optimization.
- `std::unique_ptr<T[]>` calls `delete[]` and offers `operator[]`.
- `std::make_unique<T>(args...)` avoids naked `new`. (Before C++17 it also prevented a leak when arguments were evaluated in an interleaved order; C++17's sequencing rules removed that issue.)
- `release()` gives up ownership without deleting; `reset(p)` deletes the old object and takes `p`; `get()` observes.
- It's the right way to hold a polymorphic object or a pimpl, and to return newly created objects from factories.

### `shared_ptr` internals

A `shared_ptr<T>` is two pointers (16 bytes): one to the object, one to a *control block*. The control block holds the strong count, the weak count, and the type-erased deleter and allocator.

- Copying increments the strong count with an atomic RMW. Destroying decrements it; the thread that drops it to zero destroys the object. The control block is freed when the weak count also reaches zero.
- The increment can be relaxed (nothing is published by acquiring a reference). The decrement needs acq\_rel: release so this thread's writes to the object happen-before destruction, and acquire on the final decrement so the destroying thread sees all of them. :mod[memory-model] explains these terms.
- Uncontended atomic increments cost a few nanoseconds; when many threads copy the same `shared_ptr`, the control block's cache line bounces between cores and each copy can cost 50–100+ ns.
- `std::make_shared` does one allocation for object and control block (faster, better locality). Downside: the object's memory can't be freed until the last `weak_ptr` is gone too.
- The deleter is type-erased and captured at construction, so `std::shared_ptr<Base> p = std::make_shared<Derived>();` calls `~Derived` correctly even without a virtual destructor. `unique_ptr<Base>` has no such protection.
- The *aliasing constructor* `shared_ptr<U>(owner, ptr)` shares `owner`'s control block while pointing at something else, such as a member.
- Two `shared_ptr`s created separately from the same raw pointer get two control blocks: double delete.
- `enable_shared_from_this` lets an object get a `shared_ptr` to itself. Calling `shared_from_this()` when no `shared_ptr` owns the object throws `std::bad_weak_ptr` (since C++17).

### Thread safety

The control block's counts are thread-safe: different `shared_ptr` objects that share ownership can be copied and destroyed concurrently. The pointee is not protected at all. And one `shared_ptr` *object* read and written by two threads is a data race, which is UB. Use `std::atomic<std::shared_ptr<T>>` (C++20) for that, though it's typically implemented with an internal lock, not lock-free.

### `weak_ptr`

A non-owning observer of a `shared_ptr`-managed object. `lock()` atomically returns a `shared_ptr` (null if expired). Uses: breaking reference cycles (parent pointers, observers), caches that shouldn't keep objects alive.

### Guidelines

- Default to `unique_ptr`. Use `shared_ptr` only for genuinely shared, non-hierarchical lifetime.
- Pass non-owning access as `T&` or `T*`, not as a smart pointer. Pass `unique_ptr` by value to transfer ownership. Pass `shared_ptr` by value only when the callee keeps a copy.
- On a hot path, avoid copying `shared_ptr`. Prefer clear single ownership, indices into pools, or intrusive reference counts.
