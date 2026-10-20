# Module 9: Smart pointers

Smart pointers encode ownership in the type system. In C++ interviews you'll often be asked to implement `unique_ptr` or `shared_ptr` on a whiteboard, and to explain why `shared_ptr` is usually kept off hot paths.

## Notes

### 9.1 `unique_ptr`

Exclusive ownership, move-only. With the default deleter it's exactly one pointer in size and compiles to the same code as a raw pointer plus `delete`.

- The deleter is part of the type: `std::unique_ptr<FILE, decltype(&std::fclose)>`. A function-pointer deleter doubles the size to 16 bytes; a stateless function object or captureless lambda stays at 8, thanks to the empty base optimization.
- `std::unique_ptr<T[]>` calls `delete[]` and offers `operator[]`.
- `std::make_unique<T>(args...)` avoids naked `new`. (Before C++17 it also prevented a leak when arguments were evaluated in an interleaved order; C++17's sequencing rules removed that issue.)
- `release()` gives up ownership without deleting; `reset(p)` deletes the old object and takes `p`; `get()` observes.
- It's the right way to hold a polymorphic object or a pimpl, and to return newly created objects from factories.

### 9.2 `shared_ptr` internals

A `shared_ptr<T>` is two pointers (16 bytes): one to the object, one to a *control block*. The control block holds the strong count, the weak count, and the type-erased deleter and allocator.

- Copying increments the strong count with an atomic RMW. Destroying decrements it; the thread that drops it to zero destroys the object. The control block is freed when the weak count also reaches zero.
- The increment can be relaxed (nothing is published by acquiring a reference). The decrement needs acq\_rel: release so this thread's writes to the object happen-before destruction, and acquire on the final decrement so the destroying thread sees all of them. Module 18 explains these terms.
- Uncontended atomic increments cost a few nanoseconds; when many threads copy the same `shared_ptr`, the control block's cache line bounces between cores and each copy can cost 50–100+ ns.
- `std::make_shared` does one allocation for object and control block (faster, better locality). Downside: the object's memory can't be freed until the last `weak_ptr` is gone too.
- The deleter is type-erased and captured at construction, so `std::shared_ptr<Base> p = std::make_shared<Derived>();` calls `~Derived` correctly even without a virtual destructor. `unique_ptr<Base>` has no such protection.
- The *aliasing constructor* `shared_ptr<U>(owner, ptr)` shares `owner`'s control block while pointing at something else, such as a member.
- Two `shared_ptr`s created separately from the same raw pointer get two control blocks: double delete.
- `enable_shared_from_this` lets an object get a `shared_ptr` to itself. Calling `shared_from_this()` when no `shared_ptr` owns the object throws `std::bad_weak_ptr` (since C++17).

### 9.3 Thread safety

The control block's counts are thread-safe: different `shared_ptr` objects that share ownership can be copied and destroyed concurrently. The pointee is not protected at all. And one `shared_ptr` *object* read and written by two threads is a data race, which is UB. Use `std::atomic<std::shared_ptr<T>>` (C++20) for that, though it's typically implemented with an internal lock, not lock-free.

### 9.4 `weak_ptr`

A non-owning observer of a `shared_ptr`-managed object. `lock()` atomically returns a `shared_ptr` (null if expired). Uses: breaking reference cycles (parent pointers, observers), caches that shouldn't keep objects alive.

### 9.5 Guidelines

- Default to `unique_ptr`. Use `shared_ptr` only for genuinely shared, non-hierarchical lifetime.
- Pass non-owning access as `T&` or `T*`, not as a smart pointer. Pass `unique_ptr` by value to transfer ownership. Pass `shared_ptr` by value only when the callee keeps a copy.
- On a hot path, avoid copying `shared_ptr`. Prefer clear single ownership, indices into pools, or intrusive reference counts.

## Predict the output

**P1**

```cpp kind=fragment run=local note="In the browser this is wasm32, where `long` and pointers are 32-bit, so sizes are halved here: 4 8 8 4."
auto close_file = [](FILE* f) { std::fclose(f); };
cout << sizeof(std::unique_ptr<int>) << ' '
     << sizeof(std::shared_ptr<int>) << ' '
     << sizeof(std::unique_ptr<FILE, int (*)(FILE*)>) << ' '
     << sizeof(std::unique_ptr<FILE, decltype(close_file)>);
```

**P2**

```cpp kind=fragment run=local
auto a = std::make_shared<int>(1);
auto b = a;
std::weak_ptr<int> w = a;
cout << a.use_count();
b.reset();
cout << a.use_count() << w.expired();
a.reset();
cout << w.expired();
```

**P3**

```cpp kind=fragment run=local
struct Node {
    std::shared_ptr<Node> next;
    ~Node() { cout << '~'; }
};
{
    auto a = std::make_shared<Node>();
    auto b = std::make_shared<Node>();
    a->next = b;
    b->next = a;
}
cout << "end";
```

**P4**

```cpp kind=fragment run=local
struct B { ~B() { cout << "~B"; } };
struct D : B { ~D() { cout << "~D"; } };
{ std::shared_ptr<B> p = std::make_shared<D>(); }
cout << '|';
{ std::unique_ptr<B> q = std::make_unique<D>(); }
```

**P5**

```cpp kind=fragment run=local
struct P { int x = 5; };
auto sp = std::make_shared<P>();
std::shared_ptr<int> xp(sp, &sp->x);
sp.reset();
cout << *xp << xp.use_count();
```

## Spot the UB

**U1**

```cpp kind=fragment run=local
int* raw = new int(5);
std::shared_ptr<int> a(raw);
std::shared_ptr<int> b(raw);
```

**U2**

```cpp kind=fragment run=local
std::shared_ptr<int> p(new int[10]);
```

**U3**

```cpp kind=fragment run=none
struct Session : std::enable_shared_from_this<Session> {
    Session() { registry.add(shared_from_this()); }
};
```

**U4**

```cpp kind=fragment run=none
std::shared_ptr<Config> g_cfg;
// thread 1:
g_cfg = std::make_shared<Config>(load());
// thread 2:
auto local = g_cfg;
```

**U5**

```cpp kind=fragment run=local
auto p = std::make_unique<int>(1);
int* r = p.get();
p.reset();
*r = 2;
```

## Exercises

**E1 ★ Deleters.** Wrap `FILE*` in `unique_ptr` three ways (function pointer, lambda type, function object struct) and `static_assert` their sizes. Do the same for a POSIX file descriptor using a custom "pointer" type.

**E2 ★★ `UniquePtr<T, D>`.** Implement it with `[[no_unique_address]] D`, move operations, `release`, `reset`, `get`, `operator*`, `operator->` and `explicit operator bool`. Assert `sizeof(UniquePtr<int>) == sizeof(int*)`.

**E3 ★★★ `SharedPtr` and `WeakPtr`.** Implement both with a control block holding atomic strong and weak counts, a type-erased deleter, and a `make_shared`-style single allocation. Use relaxed increments and acq\_rel decrements, and write a comment justifying each memory order. Stress-test with TSan: 8 threads copying and dropping the same pointer.

**E4 ★★ Contention benchmark.** Measure the cost per copy-and-destroy of a `shared_ptr` from 1, 2, 4 and 8 threads sharing one control block, vs each thread owning its own. Explain the curve.

**E5 ★★ Ownership design.** For an order book where price levels list their orders and a hash map indexes orders by ID, design the ownership: who owns orders, and what do the other structures hold? Compare `shared_ptr` everywhere, `unique_ptr` in the map with raw pointers in levels, and a preallocated pool with intrusive lists. Justify your choice for latency and safety.

## Interview questions

1. What's the overhead of `unique_ptr` compared to a raw pointer?
2. Describe the memory layout of a `shared_ptr`.
3. Pros and cons of `make_shared`?
4. Is `shared_ptr` thread-safe? Be precise.
5. Why can the refcount increment be relaxed while the decrement needs acq\_rel?
6. When do you need `weak_ptr`?
7. What does `enable_shared_from_this` do, and what's its pitfall?
8. Why do low-latency systems avoid `shared_ptr` on hot paths?
9. How should you pass smart pointers to functions?
10. Why does `shared_ptr<Base>` from `make_shared<Derived>` destroy correctly without a virtual destructor, while `unique_ptr<Base>` doesn't?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `8 16 16 8` | Object pointer + control block pointer; a function-pointer deleter must be stored; a captureless lambda is empty. |
| P2 | `2101` | Weak pointers don't count toward `use_count`. |
| P3 | `end` | The cycle keeps both counts at 1; nothing is destroyed, both leak. Make one link a `weak_ptr`. |
| P4 | `~D~B\|` then UB | `shared_ptr` captured a deleter for `D`. `unique_ptr<B>` calls `delete` on a `B*` without a virtual destructor: UB (typically prints `~B`). |
| P5 | `51` | The aliasing pointer keeps the whole `P` alive and is now the only owner. |

### Spot the UB

- **U1:** Two control blocks own the same int, so it's deleted twice. Create it once with `make_shared` and copy the `shared_ptr`.
- **U2:** UB: the default deleter calls `delete`, not `delete[]`. Use `std::shared_ptr<int[]>` (C++17) or `std::vector`.
- **U3:** Not UB, but no `shared_ptr` owns the object yet during construction, so `shared_from_this()` throws `std::bad_weak_ptr`. Register from a factory after `make_shared`.
- **U4:** Data race on the `g_cfg` object itself: UB. Use `std::atomic<std::shared_ptr<Config>>` or protect it with a mutex.
- **U5:** Use-after-free through the observing pointer `r`.

### Exercise hints

- **E3:** On the final strong decrement, destroy the object, then decrement the weak count (the strong owners collectively hold one weak reference) and free the block when it reaches zero.
- **E4:** One thread: a few ns. Multiple threads: each RMW needs exclusive ownership of the cache line, so cost grows with contention to tens or hundreds of ns.
- **E5:** A common low-latency answer: preallocated `Order` pool owning all orders, intrusive doubly linked lists per level, and an open-addressing map from ID to pool index. No allocation and no refcounting per message.

### Interview questions

1. None in size or speed with the default or a stateless deleter; a stateful deleter adds its size.
2. Two pointers: to the object and to a control block with strong count, weak count, deleter and allocator (with `make_shared`, the object lives inside the block).
3. Pros: one allocation, locality, exception-safe. Cons: can't use a custom deleter, and the object's memory stays allocated while weak pointers exist.
4. Count updates are thread-safe, so distinct `shared_ptr` copies can be used from different threads. The pointee isn't protected, and concurrent writes to the same `shared_ptr` object are a data race.
5. Taking a new reference doesn't publish any data, so only atomicity matters. The decrement must order prior accesses to the object before its destruction in whichever thread deletes it.
6. To observe without owning: breaking cycles, caches, observer lists, back-pointers from child to parent.
7. Lets a member function create a `shared_ptr` sharing existing ownership. It only works once a `shared_ptr` already owns the object, so not in the constructor.
8. Atomic refcount traffic, cache-line contention between threads, extra indirection, control block allocation, and unclear ownership.
9. Non-owning: `T&` or `T*`. Transfer: `unique_ptr<T>` by value. Share: `shared_ptr<T>` by value if the callee stores it, otherwise don't pass a smart pointer at all.
10. The `shared_ptr` control block stores a deleter created from the original `Derived*`. `unique_ptr<Base>`'s default deleter just calls `delete` on a `Base*`.
