:::predict{#P1}
```cpp
std::map<std::string, int> m;
if (m["a"] == 0) {}
cout << m.size();
m.find("b");
cout << m.size();
m.count("c");
cout << m.size();
```
::answer
`111`

Only `operator[]` inserts.
:::

:::predict{#P2}
```cpp
std::vector<bool> v{true, false};
auto x = v[0];
v[0] = false;
cout << x;
```
::answer
`0`

`x` is a `vector<bool>::reference` proxy, not a copy of the bool.
:::

:::predict{#P3}
```cpp
std::string s = "hello world";
std::string_view sv(s.data(), 5);
cout << sv << '|' << sv.data();
```
::answer
`hello|hello world`

`sv.data()` points into `s`; the view's length isn't a terminator.
:::

:::predict{#P4}
```cpp
std::vector<std::vector<int>> v;
v.emplace_back(3);
v.push_back({3});
cout << v[0].size() << ' ' << v[1].size();
```
::answer
`3 1`

`emplace_back(3)` calls `vector<int>(3)`; `push_back({3})` builds `{3}` from an initializer list.
:::

:::predict{#P5}
```cpp
std::vector<int> v{1, 2, 3, 2, 5};
std::remove(v.begin(), v.end(), 2);
cout << v.size() << ' ';
auto n = std::erase(v, 2);
cout << v.size() << ' ' << n;
```
::choices
- [ ] `5`, then always `3 2`
- [ ] `3`, then always `3 0`
- [x] `5`, then unspecified (`4 1` in practice)
- [ ] `5`, then always `5 0`
::answer
`5`, then unspecified (`4 1` in practice).

`remove` shifts kept elements forward (`1 3 5`) but doesn't change size; the tail is unspecified. libc++ and libstdc++ leave the original `2 5` there, so `std::erase` then finds and removes one 2.
:::

:::predict{#P6}
~~~cpp note="In the browser this is wasm32, where `long` and pointers are 32-bit, so std::string is 12 bytes here."
cout << sizeof(std::string);   // on libc++ and on libstdc++
~~~
::choices
- [ ] `24` on both
- [x] `24` on libc++, `32` on libstdc++
- [ ] `32` on libc++, `24` on libstdc++
- [ ] `32` on both
::answer
`24` on libc++, `32` on libstdc++.

Different SSO layouts.
:::
