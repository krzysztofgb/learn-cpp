:::bug{#U1 findings=ub}
```cpp
int* p = nullptr;
int& r = *p;
```
::answer
UB. Dereferencing a null pointer, even just to bind a reference, is undefined.
:::

:::bug{#U2 findings=ub}
```cpp
char* s = const_cast<char*>("hello");
s[0] = 'H';
```
::answer
UB. String literals are immutable; casting away `const` doesn't change that. Use `char s[] = "hello";` for a mutable copy.
:::

:::bug{#U3 findings=ub}
```cpp
int* make() {
    int x = 42;
    return &x;
}
```
::answer
UB as soon as the caller uses the pointer, because `x` is dead. Returning it is legal in itself. Compilers warn with `-Wreturn-stack-address`.
:::

:::bug{#U4 findings=ub,unspecified}
```cpp
int a[3], b[3];
bool before = &a[0] < &b[0];
auto dist = &b[0] - &a[0];
```
::answer
Unspecified and UB: `<` on unrelated pointers is unspecified, not UB, while the subtraction is UB because the pointers belong to different arrays.
:::

:::bug{#U5 findings=ub}
```cpp
int a[4];
for (int i = 0; i <= 4; ++i) a[i] = i;
```
::answer
UB on the last iteration: writing `a[4]` is out of bounds.
:::

:::bug{#U6 findings=ub}
```cpp
int* p = new int[10];
delete p;
```
::answer
UB. Memory from `new[]` must be released with `delete[]`.
:::

:::bug{#U7 findings=ub}
```cpp
std::vector<int> v{1, 2, 3};
int& first = v[0];
v.push_back(4);
first = 10;
```
::answer
UB if `push_back` reallocates, which it does here since capacity was 3. `first` dangles.
:::
