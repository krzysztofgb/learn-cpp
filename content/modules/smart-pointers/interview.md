:::question{#Q1}
What's the overhead of `unique_ptr` compared to a raw pointer?
::answer
None in size or speed with the default or a stateless deleter; a stateful deleter adds its size.
:::

:::question{#Q2}
Describe the memory layout of a `shared_ptr`.
::answer
Two pointers: to the object and to a control block with strong count, weak count, deleter and allocator (with `make_shared`, the object lives inside the block).
:::

:::question{#Q3}
Pros and cons of `make_shared`?
::answer
Pros: one allocation, locality, exception-safe. Cons: can't use a custom deleter, and the object's memory stays allocated while weak pointers exist.
:::

:::question{#Q4}
Is `shared_ptr` thread-safe? Be precise.
::answer
Count updates are thread-safe, so distinct `shared_ptr` copies can be used from different threads. The pointee isn't protected, and concurrent writes to the same `shared_ptr` object are a data race.
:::

:::question{#Q5}
Why can the refcount increment be relaxed while the decrement needs acq\_rel?
::answer
Taking a new reference doesn't publish any data, so only atomicity matters. The decrement must order prior accesses to the object before its destruction in whichever thread deletes it.
:::

:::question{#Q6}
When do you need `weak_ptr`?
::answer
To observe without owning: breaking cycles, caches, observer lists, back-pointers from child to parent.
:::

:::question{#Q7}
What does `enable_shared_from_this` do, and what's its pitfall?
::answer
Lets a member function create a `shared_ptr` sharing existing ownership. It only works once a `shared_ptr` already owns the object, so not in the constructor.
:::

:::question{#Q8}
Why do low-latency systems avoid `shared_ptr` on hot paths?
::answer
Atomic refcount traffic, cache-line contention between threads, extra indirection, control block allocation, and unclear ownership.
:::

:::question{#Q9}
How should you pass smart pointers to functions?
::answer
Non-owning: `T&` or `T*`. Transfer: `unique_ptr<T>` by value. Share: `shared_ptr<T>` by value if the callee stores it, otherwise don't pass a smart pointer at all.
:::

:::question{#Q10}
Why does `shared_ptr<Base>` from `make_shared<Derived>` destroy correctly without a virtual destructor, while `unique_ptr<Base>` doesn't?
::answer
The `shared_ptr` control block stores a deleter created from the original `Derived*`. `unique_ptr<Base>`'s default deleter just calls `delete` on a `Base*`.
:::
