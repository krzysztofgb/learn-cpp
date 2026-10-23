For each, list which final results are allowed by the C++ model, and which you'd actually observe on x86 and ARM. All variables start at 0.

:::predict{#P1}
(`d` and `f` are `std::atomic<int>`, all relaxed)

```cpp run=none
// T1                              // T2
d.store(42, relaxed);              r1 = f.load(relaxed);
f.store(1, relaxed);               r2 = d.load(relaxed);
```

Can `r1 == 1 && r2 == 0`?
::choices
- [ ] No: `d` is stored before `f` in program order
- [x] Yes; x86 hardware won't show it, ARM can
- [ ] Yes, on x86 and ARM hardware alike
- [ ] Yes, but only on x86
::answer
Yes; x86 hardware won't show it, ARM can.

On x86, not observed (TSO keeps store-store and load-load order), unless the compiler reorders; on ARM, observable.
:::

:::predict{#P2}
Same as P1, but `f.store(1, release)` and `f.load(acquire)`.
::choices
- [ ] Yes, but only on ARM
- [ ] Yes: acquire and release only order `f` itself
- [x] No, on any platform
- [ ] Only if the compiler reorders the stores
::answer
No, on any platform.

If the acquire load reads 1, it synchronizes with the release store, so `d.store(42)` happens before `r2 = d.load()`, which must then see 42.
:::

:::predict{#P3}
```cpp run=none
// T1                              // T2
x.store(1, release);               y.store(1, release);
r1 = y.load(acquire);              r2 = x.load(acquire);
```

Can `r1 == 0 && r2 == 0`? What changes with `seq_cst`?
::choices
- [ ] No in both cases: each store comes before its thread's load
- [ ] Yes, but only on ARM; with `seq_cst`: no
- [x] Yes; with `seq_cst`: no
- [ ] Yes, and `seq_cst` doesn't change that
::answer
Yes; with `seq_cst`, no.

Observed on both x86 and ARM (store buffer): release/acquire never orders a store before a later load of a different variable. `seq_cst` puts all four operations in one total order, so at least one load sees the other thread's store.
:::

:::predict{#P4}
Four threads each run `for (int i = 0; i < 1'000'000; ++i) c.fetch_add(1, std::memory_order_relaxed);`. What's the final value of `c`?
::choices
- [ ] Anywhere from 1,000,000 to 4,000,000
- [ ] 4,000,000 on x86, possibly less on ARM
- [x] Exactly 4,000,000
- [ ] Undefined: relaxed increments race
::answer
Exactly 4,000,000.

`fetch_add` is one atomic read-modify-write; relaxed drops ordering with other memory, not atomicity.
:::

:::predict{#P5}
Two threads each run `for (int i = 0; i < 1000; ++i) x = x + 1;` where `x` is `std::atomic<int>`. What's the range of possible final values? Is it UB?
::choices
- [ ] Exactly 2000; not UB
- [ ] 1000 to 2000; not UB
- [x] 2 to 2000; not UB
- [ ] Anything: it's UB
::answer
Anywhere from 2 to 2000; not UB.

`x = x + 1` is an atomic load followed by a separate atomic store, so updates can be lost, but every access is atomic, so there's no data race. For 2: T1 loads 0, T2 runs 999 iterations, T1 stores 1, T2 loads 1, T1 finishes its loop, T2 stores 2.
:::

:::predict{#P6 expect=ub}
```cpp
volatile bool ready = false;
int data = 0;
// T1: data = 42; ready = true;
// T2: while (!ready) {} std::cout << data;
```
::answer
UB

`volatile` makes accesses neither atomic nor ordered, so both `ready` and `data` race. It often "works" anyway.
:::
