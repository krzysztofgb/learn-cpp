### `unique_ptr`

Exclusive ownership, move-only: the copy operations are deleted, ownership moves with `std::move`, and a moved-from `unique_ptr` is null. With the default deleter it's exactly one pointer in size and compiles to the same code as a raw pointer plus `delete`.

- The deleter is part of the type: `std::unique_ptr<FILE, decltype(&std::fclose)>`. A function-pointer deleter must be stored, doubling the size to 16 bytes; a stateless function object or captureless lambda is an empty class and stays at 8, thanks to the empty base optimization. C++20's `[[no_unique_address]]` does the same for a member: an empty member may share its address with another one and take no space (MSVC ignores the standard attribute for ABI reasons and needs `[[msvc::no_unique_address]]`).
- If the deleter type defines a nested `pointer` type, `unique_ptr<T, D>` stores and hands out that type instead of `T*`. It must behave like a nullable pointer: a value-initialized one is null, and it can be constructed from and compared with `nullptr`. That lets `unique_ptr` own handles that aren't pointers, such as a file descriptor wrapped in a small struct.
- `std::unique_ptr<T[]>` calls `delete[]` and offers `operator[]`.
- `std::make_unique<T>(args...)` avoids naked `new`. (Before C++17 it also prevented a leak when arguments were evaluated in an interleaved order; C++17's sequencing rules removed that issue.)
- `release()` gives up ownership without deleting; `reset(p)` deletes the old object and takes `p`; `get()` observes. A raw pointer from `get()` doesn't keep anything alive: once the `unique_ptr` deletes the object, the raw pointer dangles.
- `if (p)` tests for null through an `explicit operator bool`, which works in conditions but doesn't silently convert to an integer.
- It's the right way to hold a polymorphic object or a pimpl, and to return newly created objects from factories.

*Further reading:* [Introduction to smart pointers and move semantics](https://www.learncpp.com/cpp-tutorial/introduction-to-smart-pointers-move-semantics/), [std::unique\_ptr](https://www.learncpp.com/cpp-tutorial/stdunique_ptr/)

### `shared_ptr` internals

A `shared_ptr<T>` is two pointers (16 bytes): one to the object, one to a *control block*. The control block holds the strong count, the weak count, and the type-erased deleter and allocator.

- Copying increments the strong count with an atomic RMW. Destroying or `reset()`ting a `shared_ptr` decrements it; the thread that drops it to zero destroys the object. `use_count()` reports the strong count only.
- The control block is freed when the weak count also reaches zero. In common implementations the strong owners collectively hold one weak reference: the final strong decrement destroys the object and then drops that reference, and whichever decrement brings the weak count to zero frees the block. So each happens exactly once without a lock.
- The increment can be relaxed (nothing is published by acquiring a reference). The decrement needs acq\_rel: release so this thread's writes to the object happen-before destruction, and acquire on the final decrement so the destroying thread sees all of them. :mod[memory-model] explains these terms.
- Uncontended atomic increments cost a few nanoseconds; when many threads copy the same `shared_ptr`, the control block's cache line bounces between cores and each copy can cost 50–100+ ns.
- `std::make_shared` does one allocation for object and control block (faster, better locality), with the object stored inside the block. Downsides: the object's memory can't be freed until the last `weak_ptr` is gone too, and it can't take a custom deleter (construct the `shared_ptr` from a pointer and a deleter for that; `std::allocate_shared` takes a custom allocator).
- The deleter is type-erased and captured at construction, so `std::shared_ptr<Base> p = std::make_shared<Derived>();` calls `~Derived` correctly even without a virtual destructor. `unique_ptr<Base>` has no such protection.
- The default deleter calls `delete`, so memory from `new T[n]` needs `std::shared_ptr<T[]>` (C++17), which calls `delete[]`, or `std::make_shared<T[]>(n)` (C++20).
- The *aliasing constructor* `shared_ptr<U>(owner, ptr)` shares `owner`'s control block while pointing at something else, such as a member. It increments the shared strong count, so the whole owning object stays alive as long as the alias does.
- Two `shared_ptr`s created separately from the same raw pointer get two control blocks: double delete.
- `enable_shared_from_this` lets an object get a `shared_ptr` to itself. Calling `shared_from_this()` when no `shared_ptr` owns the object throws `std::bad_weak_ptr` (since C++17).

*Further reading:* [std::shared\_ptr](https://www.learncpp.com/cpp-tutorial/stdshared_ptr/)

### Thread safety

The control block's counts are thread-safe: different `shared_ptr` objects that share ownership can be copied and destroyed concurrently. The pointee is not protected at all. And one `shared_ptr` *object* read and written by two threads is a data race, which is UB. Use `std::atomic<std::shared_ptr<T>>` (C++20) for that, though it's typically implemented with an internal lock, not lock-free.

*Further reading:* [`std::atomic<std::shared_ptr>`](https://en.cppreference.com/w/cpp/memory/shared_ptr/atomic2)

### `weak_ptr`

A non-owning observer of a `shared_ptr`-managed object. It increments only the weak count, so it never keeps the object alive. `lock()` atomically returns a `shared_ptr` (null if expired); `expired()` is `use_count() == 0`. Uses: breaking reference cycles (parent pointers, observers), caches that shouldn't keep objects alive.

A cycle of `shared_ptr`s (A owns B and B owns A) keeps every strong count in it at 1 or more after all outside owners are gone, so no destructor in the cycle ever runs and all of it leaks. Making one link of the cycle a `weak_ptr` lets the counts reach zero.

*Further reading:* [Circular dependency issues with std::shared\_ptr, and std::weak\_ptr](https://www.learncpp.com/cpp-tutorial/circular-dependency-issues-with-stdshared_ptr-and-stdweak_ptr/)

### Guidelines

- Default to `unique_ptr`. Use `shared_ptr` only for genuinely shared, non-hierarchical lifetime.
- Pass non-owning access as `T&` or `T*`, not as a smart pointer. Pass `unique_ptr` by value to transfer ownership. Pass `shared_ptr` by value only when the callee keeps a copy.
- On a hot path, avoid copying `shared_ptr`. Prefer clear single ownership, indices into pools, or intrusive reference counts.
- An *intrusive* structure keeps its bookkeeping inside the element: an intrusive reference count is a counter member of the object, and an intrusive list stores the `prev`/`next` links in the element itself, so linking and unlinking allocate nothing. Combined with a preallocated pool that owns every object (:mod[raw-memory]), they remove both allocation and refcounting from the hot path.
