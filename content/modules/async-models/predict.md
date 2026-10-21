:::predict{#P1}
```cpp run=none
std::packaged_task<int(int)> t([](int x) { return x * 2; });
auto f = t.get_future();
t(21);
cout << f.get();
```
::answer
`42`

Invoking the task fulfills its future.
:::

:::predict{#P2}
```cpp run=none
std::promise<int> p;
auto f = p.get_future();
p.set_exception(std::make_exception_ptr(std::runtime_error("rejected")));
try { f.get(); } catch (const std::exception& e) { cout << e.what(); }
```
::answer
`rejected`

`get()` rethrows the stored exception.
:::

:::predict{#P3}
```cpp run=none
std::future<int> f;
{
    std::promise<int> p;
    f = p.get_future();
}
try { f.get(); }
catch (const std::future_error& e) { cout << (e.code() == std::future_errc::broken_promise); }
```
::answer
`1`

Destroying an unsatisfied promise stores a `broken_promise` error.
:::

:::predict{#P4}
(with `stdexec`, the reference implementation of `std::execution`)

```cpp run=none
auto s = stdexec::just(3)
       | stdexec::then([](int x) { cout << 'A'; return x + 1; });
cout << 'B';
auto [r] = stdexec::sync_wait(std::move(s)).value();
cout << r;
```
::answer
`BA4`

Senders are lazy; `then`'s function runs only inside `sync_wait`.
:::

:::predict{#P5}
A pool has 4 workers. You submit 4 tasks, and each task submits a subtask to the same pool and blocks on its future. What happens?
::answer
Deadlock

All 4 workers block waiting for subtasks that no free worker can run.
:::
