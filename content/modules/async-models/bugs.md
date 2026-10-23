:::bug{#U1 findings=ub}
```cpp run=none
auto f = pool.submit(compute);
int a = f.get();
int b = f.get();
```
::answer
UB: the second `get()` runs on an invalid future (implementations typically throw `future_error`). Store the result, or use `std::shared_future`.
:::

:::bug{#U2 findings=ub}
```cpp run=none
void schedule_reports(ThreadPool& pool) {
    std::vector<Report> reports = build();
    for (auto& r : reports) pool.submit([&r] { send(r); });
}
```
::answer
UB: the lambdas capture references to elements of a local vector destroyed when the function returns, while tasks may still be queued, so they dangle. Move each `Report` into its lambda.
:::

:::bug{#U3 findings=defined-bug}
```cpp run=none
ThreadPool::~ThreadPool() {
    for (auto& t : workers_) t.join();   // workers block forever in cv.wait
}
```
::answer
A defined bug, a hang: workers wait on the condition variable with no stop signal, so `join` never returns. Set a stop flag under the lock, `notify_all`, then join (or use `jthread` with `stop_token` and `condition_variable_any`).
:::

:::bug{#U4 findings=ub}
```cpp run=none
Task<void> refresh(Cache& cache, std::string_view key) {
    auto data = co_await fetch(std::string(key));
    cache.put(key, data);
}
// called as: refresh(cache, make_key(sym));
```
::answer
UB: `key` views a temporary string that dies when the caller's statement ends, but it's used after the `co_await`. Take `std::string` by value.
:::
