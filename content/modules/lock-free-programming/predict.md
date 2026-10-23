:::predict{#P1}
```cpp
std::atomic<int> a{5};
int expected = 3;
bool ok = a.compare_exchange_strong(expected, 10);
cout << ok << ' ' << expected << ' ' << a;
```
::answer
`0 5 5`

The CAS fails and writes the current value into `expected`.
:::

:::predict{#P2}
```cpp
struct Counters {
    alignas(64) std::atomic<long> a;
    alignas(64) std::atomic<long> b;
};
cout << sizeof(Counters) << ' ' << alignof(Counters);
```
::answer
`128 64`

Each member starts on its own 64-byte boundary.
:::

:::predict{#P3}
A ring buffer of 8 slots uses masked indices `head` and `tail` in \[0, 7\] with `head == tail` meaning empty and no separate count. How many items can it hold? What changes with free-running 64-bit indices?
::choices
- [ ] 8 in both cases
- [ ] 7 in both cases
- [x] 7; with free-running indices: 8
- [ ] 6; with free-running indices: 7
::answer
7; with free-running indices, 8.

With masked indices, full and empty would both look like `head == tail`, so one slot stays empty. Free-running indices make full `tail - head == 8`.
:::

:::predict{#P4}
A Treiber stack holds `A → B → C`. Thread 1 starts `pop`: reads `head = A`, `next = B`, then is preempted. Thread 2 pops `A`, pops `B`, frees both, then pushes a new node allocated at `A`'s old address. Thread 1 resumes and does `CAS(head, A, B)`. What happens?
::choices
- [ ] The CAS fails because the node at `A`'s address is a new object, and thread 1 retries
- [ ] The CAS succeeds and the stack is fine, since `head` really is `A` again
- [x] The CAS succeeds and installs the freed `B` as head, corrupting the stack
- [ ] The CAS fails because thread 2 changed `head` twice, and thread 1 retries
::answer
Corruption.

The CAS succeeds because `head` equals `A` again, installing freed `B` as the head: use-after-free and a corrupted stack.
:::

:::predict{#P5}
Two threads each increment their own `std::atomic<long>` 100M times with relaxed `fetch_add`. In version 1 the counters are adjacent in a struct; in version 2 they're 128 bytes apart. Roughly how do the run times compare on your machine?
::choices
- [ ] About the same: each thread touches only its own counter
- [ ] Adjacent is faster: both counters share one cache line
- [x] Adjacent is several times slower
- [ ] Adjacent is slightly slower, within about 10%
::answer
Adjacent is several times slower.

Every increment invalidates the other core's copy of the shared line. Version 2 avoids that on x86 and most ARM servers (64-byte lines); on Apple Silicon, whose lines are 128 bytes, 128-byte separation is exactly what's needed.
:::
