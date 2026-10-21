:::bug{#U1}
```cpp
std::vector<int> v{1, 2, 3};
std::vector<int> w = std::move(v);
std::cout << v[0];
```
::answer
`v` is valid but unspecified; in practice empty, so `v[0]` is out of bounds: UB. Only call operations without preconditions on moved-from objects, or reassign first.
:::

:::bug{#U2}
```cpp
std::string&& make_name() {
    std::string s = "AAPL";
    return std::move(s);
}
```
::answer
Returns a reference to a local that's destroyed on return: dangling, UB on use. Return `std::string` by value.
:::

:::bug{#U3}
```cpp run=none
template <class T>
void log_and_store(T&& x) {
    store_.push_back(std::forward<T>(x));
    logger_.write(std::forward<T>(x));
}
```
::answer
If `x` was an rvalue, the first `forward` may move it into `store_`, and the logger sees a moved-from value. Forward only on the last use.
:::

:::bug{#U4}
```cpp run=none
std::vector<int> get_levels();
auto&& first = get_levels()[0];
std::cout << first;
```
::answer
`operator[]` returns a reference into the temporary vector, which dies at the end of the statement. `first` dangles. Bind the vector to a variable first.
:::

:::bug{#U5}
```cpp run=none
Buffer& Buffer::operator=(Buffer&& o) noexcept {
    delete[] data_;
    data_ = o.data_;
    size_ = o.size_;
    o.data_ = nullptr;
    return *this;
}
// later: buf = std::move(buf);
```
::answer
Self-move-assignment deletes the buffer, then keeps a pointer to it and nulls it: data loss and a dangling pointer in the general case. Guard with `if (this != &o)` or use move-and-swap.
:::
