:::bug{#U1 findings=ub}
```cpp
std::vector<int> v{1, 2, 3};
std::vector<int> w = std::move(v);
std::cout << v[0];
```
::answer
UB: `vector`'s move constructor leaves `v` empty, so `v[0]` is out of bounds. In general a moved-from object is only valid but unspecified: call only operations without preconditions on it, or reassign it first.
:::

:::bug{#U2 findings=ub}
```cpp
std::string&& make_name() {
    std::string s = "AAPL";
    return std::move(s);
}
```
::answer
UB on use: it returns a reference to a local that's destroyed on return, so the reference dangles. Return `std::string` by value.
:::

:::bug{#U3 findings=defined-bug}
```cpp run=none
template <class T>
void log_and_store(T&& x) {
    store_.push_back(std::forward<T>(x));
    logger_.write(std::forward<T>(x));
}
```
::answer
A defined logic bug: if `x` was an rvalue, the first `forward` may move it into `store_`, and the logger sees a moved-from value. Forward only on the last use.
:::

:::bug{#U4 findings=ub}
```cpp run=none
std::vector<int> get_levels();
auto&& first = get_levels()[0];
std::cout << first;
```
::answer
UB: `operator[]` returns a reference into the temporary vector, which dies at the end of the statement, so `first` dangles. Bind the vector to a variable first.
:::

:::bug{#U5 findings=defined-bug}
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
A defined bug (data loss): self-move-assignment deletes the buffer, then `o.data_ = nullptr` also nulls `this->data_`, leaving an empty buffer with a stale `size_` that makes any later element access UB. Guard with `if (this != &o)` or use move-and-swap.
:::
