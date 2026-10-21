:::bug{#U1}
```cpp
int* p = nullptr;
int& r = *p;
```
::answer
UB. Dereferencing a null pointer, even just to bind a reference, is undefined.
:::

:::bug{#U2}
```cpp
char* s = const_cast<char*>("hello");
s[0] = 'H';
```
::answer
UB. String literals are immutable; casting away `const` doesn't change that. Use `char s[] = "hello";` for a mutable copy.
:::

:::bug{#U3}
```cpp
int* make() {
    int x = 42;
    return &x;
}
```
::answer
Returning the pointer is legal; using it is UB because `x` is dead. Compilers warn with `-Wreturn-stack-address`.
:::

:::bug{#U4}
```cpp
int a[3], b[3];
bool before = &a[0] < &b[0];
auto dist = &b[0] - &a[0];
```
::answer
`<` on unrelated pointers is unspecified, not UB. The subtraction is UB because the pointers belong to different arrays.
:::

:::bug{#U5}
```cpp
int a[4];
for (int i = 0; i <= 4; ++i) a[i] = i;
```
::answer
UB on the last iteration: writing `a[4]` is out of bounds.
:::

:::bug{#U6}
```cpp
int* p = new int[10];
delete p;
```
::answer
UB. Memory from `new[]` must be released with `delete[]`.
:::

:::bug{#U7}
```cpp
std::vector<int> v{1, 2, 3};
int& first = v[0];
v.push_back(4);
first = 10;
```
::answer
UB if `push_back` reallocates, which it does here since capacity was 3. `first` dangles.
:::
