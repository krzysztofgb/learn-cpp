:::exercise{#E1 level=warm-up title="Deleters"}
Wrap `FILE*` in `unique_ptr` three ways (function pointer, lambda type, function object struct) and `static_assert` their sizes. Do the same for a POSIX file descriptor (on Windows, a `HANDLE` closed with `CloseHandle`) using a custom "pointer" type.
:::

:::exercise{#E2 level=standard title="`UniquePtr<T, D>`"}
Implement it with `[[no_unique_address]] D`, move operations, `release`, `reset`, `get`, `operator*`, `operator->` and `explicit operator bool`. Assert `sizeof(UniquePtr<int>) == sizeof(int*)`.
:::

:::exercise{#E3 level=interview-hard title="`SharedPtr` and `WeakPtr`"}
Implement both with a control block holding atomic strong and weak counts, a type-erased deleter, and a `make_shared`-style single allocation. Use relaxed increments and acq\_rel decrements, and write a comment justifying each memory order. Stress-test with ThreadSanitizer (Clang or GCC on Linux or macOS; MSVC doesn't have it): 8 threads copying and dropping the same pointer.
::hint
On the final strong decrement, destroy the object, then decrement the weak count (the strong owners collectively hold one weak reference) and free the block when it reaches zero.
:::

:::exercise{#E4 level=standard title="Contention benchmark"}
Measure the cost per copy-and-destroy of a `shared_ptr` from 1, 2, 4 and 8 threads sharing one control block, vs each thread owning its own. Explain the curve.
::hint
One thread: a few ns. Multiple threads: each RMW needs exclusive ownership of the cache line, so cost grows with contention to tens or hundreds of ns.
:::

:::exercise{#E5 level=standard title="Ownership design"}
For an order book where price levels list their orders and a hash map indexes orders by ID, design the ownership: who owns orders, and what do the other structures hold? Compare `shared_ptr` everywhere, `unique_ptr` in the map with raw pointers in levels, and a preallocated pool with intrusive lists. Justify your choice for latency and safety.
::hint
A common low-latency answer: preallocated `Order` pool owning all orders, intrusive doubly linked lists per level, and an open-addressing map from ID to pool index. No allocation and no refcounting per message.
:::
