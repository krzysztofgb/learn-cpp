:::bug{#U1 findings=ub}
```cpp
int* raw = new int(5);
std::shared_ptr<int> a(raw);
std::shared_ptr<int> b(raw);
```
::answer
UB: two control blocks own the same int, so it's deleted twice. Create it once with `make_shared` and copy the `shared_ptr`.
:::

:::bug{#U2 findings=ub}
```cpp
std::shared_ptr<int> p(new int[10]);
```
::answer
UB: the default deleter calls `delete`, not `delete[]`. Use `std::shared_ptr<int[]>` (C++17) or `std::vector`.
:::

:::bug{#U3 findings=defined-bug}
```cpp run=none
struct Session : std::enable_shared_from_this<Session> {
    Session() { registry.add(shared_from_this()); }
};
```
::answer
A defined bug, not UB (since C++17): no `shared_ptr` owns the object yet during construction, so `shared_from_this()` throws `std::bad_weak_ptr`. Register from a factory after `make_shared`.
:::

:::bug{#U4 findings=ub}
```cpp run=none
std::shared_ptr<Config> g_cfg;
// thread 1:
g_cfg = std::make_shared<Config>(load());
// thread 2:
auto local = g_cfg;
```
::answer
Data race on the `g_cfg` object itself: UB. Use `std::atomic<std::shared_ptr<Config>>` or protect it with a mutex.
:::

:::bug{#U5 findings=ub}
```cpp
auto p = std::make_unique<int>(1);
int* r = p.get();
p.reset();
*r = 2;
```
::answer
UB: use-after-free through the observing pointer `r`.
:::
