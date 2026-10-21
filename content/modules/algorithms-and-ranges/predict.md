:::predict{#P1}
```cpp
std::vector<int> v{5, 1, 4, 2, 3};
std::nth_element(v.begin(), v.begin() + 2, v.end());
cout << v[2];
```
::answer
`3`

The element at index 2 is what a full sort would put there.
:::

:::predict{#P2}
```cpp
std::vector<int> v{1, 2, 2, 2, 3};
cout << (std::lower_bound(v.begin(), v.end(), 2) - v.begin())
     << (std::upper_bound(v.begin(), v.end(), 2) - v.begin());
```
::answer
`14`

First 2 at index 1; first element greater than 2 at index 4.
:::

:::predict{#P3}
```cpp
std::vector<int> v{1, 1, 2, 1, 1};
v.erase(std::unique(v.begin(), v.end()), v.end());
cout << v.size();
```
::answer
`3`

Only adjacent duplicates collapse: `1 2 1`.
:::

:::predict{#P4}
```cpp
auto sq = [](int x) { cout << 's' << x << ' '; return x * x; };
auto view = std::views::iota(1, 100)
          | std::views::transform(sq)
          | std::views::take(2);
cout << "start ";
for (int x : view) cout << x << ' ';
```
::answer
` start s1 1 s2 4  `

Nothing runs until iteration; each element is transformed once when dereferenced.
:::

:::predict{#P5}
```cpp
auto dbl = [](int x) { cout << 't'; return x * 2; };
for (int x : std::views::iota(0, 3)
           | std::views::transform(dbl)
           | std::views::filter([](int x) { return x > 0; }))
    cout << x;
```
::answer
`ttt2tt4`

`filter` dereferences to test the predicate, then the loop dereferences again, calling the transform a second time for each passing element.
:::

:::predict{#P6}
```cpp
std::vector<double> v{0.5, 0.5, 0.5};
cout << std::accumulate(v.begin(), v.end(), 0) << ' '
     << std::accumulate(v.begin(), v.end(), 0.0);
```
::answer
`0 1.5`

With `int` init, each step truncates: 0 + 0.5 → 0.
:::
