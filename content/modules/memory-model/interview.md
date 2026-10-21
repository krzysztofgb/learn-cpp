:::question{#Q1}
What is a data race, precisely? Why is it UB rather than "some value"?
::answer
Two conflicting accesses from different threads, at least one non-atomic, not ordered by happens-before. It's UB so compilers can optimize single-threaded code freely (keep values in registers, reorder, merge accesses), which would be impossible if every plain access had to behave sensibly under concurrency.
:::

:::question{#Q2}
Explain acquire and release semantics with an example.
::answer
A release store makes all prior writes in that thread visible to any thread whose acquire load reads the stored value. The message-passing example in :sec[memory-model/memory-orders].
:::

:::question{#Q3}
When is `memory_order_relaxed` correct?
::answer
When only the atomic variable's own value matters: counters, statistics, IDs, flags whose readers don't then read other data based on them.
:::

:::question{#Q4}
What does `seq_cst` give you beyond acquire/release? Give the example that needs it.
::answer
A single total order over all `seq_cst` operations. Store buffering (Dekker, Peterson): each thread writes its flag then reads the other's; only SC forbids both seeing 0.
:::

:::question{#Q5}
Is x86 sequentially consistent? What reordering does it allow?
::answer
No. It's TSO: a later load can complete before an earlier store to a different address becomes visible (store buffer). Everything else is ordered.
:::

:::question{#Q6}
Why does code with wrong memory orders often work on x86 but fail on ARM?
::answer
x86 provides acquire/release ordering for every plain load and store, so code missing those orders still works on x86. ARM reorders independent loads and stores, exposing the bug.
:::

:::question{#Q7}
What is `volatile` for, and why is it wrong for threads?
::answer
Accesses with side effects the compiler can't see: memory-mapped hardware registers, `setjmp`, signal handlers (with `sig_atomic_t`). It provides neither atomicity nor ordering between threads.
:::

:::question{#Q8}
`compare_exchange_weak` vs `_strong`?
::answer
Weak may fail even if the value matched (allowing a single LL/SC attempt); use it in loops. Strong only fails on real mismatch; use it when a spurious failure would require expensive extra work.
:::

:::question{#Q9}
What do fences do, and when would you use one instead of ordered operations?
::answer
Fences order relaxed operations around them without attaching order to one specific atomic. Use them when one acquire or release should cover several atomics, or in seqlocks.
:::

:::question{#Q10}
Define happens-before and synchronizes-with.
::answer
Synchronizes-with: the edge from a release operation to an acquire operation that reads its value. Happens-before: the transitive closure of sequenced-before and synchronizes-with (roughly); if A happens-before B, B observes A.
:::

:::question{#Q11}
Is `std::atomic<T>` always lock-free?
::answer
No. Check `is_always_lock_free`. Large or odd-sized `T` uses a lock internally; 16-byte types depend on the CPU and compiler flags.
:::
