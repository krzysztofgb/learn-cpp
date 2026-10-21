:::predict{#P1}
```cpp run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
void start() { std::thread t([] {}); }
int main() { start(); cout << "ok"; }
```
::answer
Terminates

`t` is destroyed while joinable, so `std::terminate` runs before "ok".
:::

:::predict{#P2}
```cpp run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
void inc(int& x) { ++x; }
int n = 0;
std::thread t(inc, std::ref(n));
t.join();
cout << n;
// What if std::ref is removed?
```
::answer
`1`; without `std::ref`: doesn't compile

`std::thread` copies arguments and passes them as rvalues, which can't bind to `int&`.
:::

:::predict{#P3}
```cpp run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
using namespace std::chrono;
auto start = steady_clock::now();
std::async(std::launch::async, [] { std::this_thread::sleep_for(1s); });
std::async(std::launch::async, [] { std::this_thread::sleep_for(1s); });
cout << duration_cast<seconds>(steady_clock::now() - start).count();
```
::answer
`2`

Each discarded future's destructor blocks until its task finishes.
:::

:::predict{#P4}
```cpp run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
thread_local int counter = 0;
auto work = [] { for (int i = 0; i < 1000; ++i) ++counter; return counter; };
int r1, r2;
std::thread a([&] { r1 = work(); });
std::thread b([&] { r2 = work(); });
a.join(); b.join();
cout << r1 << ' ' << r2 << ' ' << counter;
```
::answer
`1000 1000 0`

Each thread has its own `counter`; main's is untouched.
:::

:::predict{#P5}
Thread A runs `std::scoped_lock lk(m1, m2);` while thread B runs `std::scoped_lock lk(m2, m1);`, repeatedly. Can they deadlock? What if each uses two `lock_guard`s in its listed order?
::answer
No; with `lock_guard`s: yes

`scoped_lock` acquires both without deadlock regardless of order; nested guards in opposite orders form a cycle.
:::
