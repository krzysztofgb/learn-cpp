:::predict{#P1}
~~~cpp note="In the browser this is wasm32, where `long` and pointers are 32-bit: the decayed int* is 4 bytes, so this prints 4 40."
template <class T> void by_val(T)  { cout << sizeof(T) << ' '; }
template <class T> void by_ref(T&) { cout << sizeof(T) << ' '; }
int arr[10];
by_val(arr); by_ref(arr);
~~~

::answer
` 8 40  `

By value decays to `int*`; by reference keeps `int[10]`.
:::

:::predict{#P2a}
Predict the output.

```cpp kind=fragment run=local
template <class T> void f(T)  { cout << 'a'; }
template <class T> void f(T*) { cout << 'b'; }
template <> void f(int*)      { cout << 'c'; }
int* p = nullptr; f(p);
```
::answer
`c`

The specialization is declared after both primaries, so it specializes the more specialized one, `f(T*)` with `T = int`. Overload resolution picks `f(T*)` for an `int*`, and its specialization runs.
:::

:::predict{#P2b}
The same declarations as the previous item, but the specialization comes second.

```cpp kind=fragment run=local
template <class T> void f(T)  { cout << 'a'; }
template <> void f(int*)      { cout << 'c'; }
template <class T> void f(T*) { cout << 'b'; }
int* p = nullptr; f(p);
```
::answer
`b`

When the specialization was declared, only `f(T)` existed, so it specializes `f(T)` with `T = int*`. Overload resolution still picks the primary `f(T*)`, which has no specialization, so it prints `b`.
:::

:::predict{#P3}
```cpp
template <class... Ts> auto sum(Ts... ts)   { return (ts + ... + 0); }
template <class... Ts> auto sub_l(Ts... ts) { return (... - ts); }
template <class... Ts> auto sub_r(Ts... ts) { return (ts - ...); }
cout << sum(1, 2, 3) << ' ' << sub_l(10, 2, 3) << ' ' << sub_r(10, 2, 3);
```
::answer
`6 5 11`

Left fold: (10 − 2) − 3. Right fold: 10 − (2 − 3).
:::

:::predict{#P4}
```cpp
template <class... Ts> constexpr std::size_t n(Ts...) { return sizeof...(Ts); }
cout << n() << n(1, "a", 2.0);
```
::answer
`03`
:::

:::predict{#P5}
```cpp
std::vector v{1, 2, 3};
std::vector v2{v.begin(), v.end()};
cout << v2.size();
```
::answer
`2`

Braces with CTAD prefer the `initializer_list` constructor, deducing `vector<vector<int>::iterator>`.
:::

:::predict{#P6}
```cpp
template <class T> struct Base { void hello() { cout << "hi"; } };
template <class T> struct Der : Base<T> {
    void go() { hello(); }
};
```
::answer
Doesn't compile

`hello` isn't found in the dependent base during phase one; write `this->hello()`. (MSVC's permissive mode accepts it.)
:::
