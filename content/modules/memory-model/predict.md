For each, list which final results are allowed by the C++ model, and which you'd actually observe on x86 and ARM. All variables start at 0.

:::predict{#P1}
(`d` and `f` are `std::atomic<int>`, all relaxed)

```cpp run=none
// T1                              // T2
d.store(42, relaxed);              r1 = f.load(relaxed);
f.store(1, relaxed);               r2 = d.load(relaxed);
```

Can `r1 == 1 && r2 == 0`?
::answer
Yes

Not observed (TSO keeps store-store and load-load order), unless the compiler reorders
:::

:::predict{#P2}
Same as P1, but `f.store(1, release)` and `f.load(acquire)`.
::answer
No

No
:::

:::predict{#P3}
```cpp run=none
// T1                              // T2
x.store(1, release);               y.store(1, release);
r1 = y.load(acquire);              r2 = x.load(acquire);
```

Can `r1 == 0 && r2 == 0`? What changes with `seq_cst`?
::answer
Yes; with `seq_cst`, no

Observed (store buffer)
:::

:::predict{#P4}
Four threads each run `for (int i = 0; i < 1'000'000; ++i) c.fetch_add(1, std::memory_order_relaxed);`. What's the final value of `c`?
::answer
Exactly 4,000,000
:::

:::predict{#P5}
Two threads each run `for (int i = 0; i < 1000; ++i) x = x + 1;` where `x` is `std::atomic<int>`. What's the range of possible final values? Is it UB?
::answer
Anywhere from 2 to 2000; not UB
:::

:::predict{#P6}
```cpp
volatile bool ready = false;
int data = 0;
// T1: data = 42; ready = true;
// T2: while (!ready) {} std::cout << data;
```
::answer
UB

Often "works"
:::
