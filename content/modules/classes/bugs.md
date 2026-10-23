:::bug{#U1 findings=ub,defined-bug}
```cpp
class Buf {
    char* data_; std::size_t n_;
public:
    Buf& operator=(const Buf& o) {
        delete[] data_;
        data_ = new char[o.n_];
        std::memcpy(data_, o.data_, o.n_);
        n_ = o.n_;
        return *this;
    }
};
```
::answer
UB on self-assignment, plus a defined exception-safety bug. When `o` is `*this`, o.data\_ is data\_, so after the delete and the new allocation, memcpy copies the fresh uninitialized buffer onto itself: the original contents are silently lost. That memcpy is formally UB, because its source and destination overlap (they're identical). Separately, it's not exception-safe: if `new` throws, `data_` dangles. Use copy-and-swap, or allocate and copy before deleting.
:::

:::bug{#U2 findings=ub}
```cpp
class Conn {
    int* fds_ = new int[64];
public:
    ~Conn() { delete[] fds_; }
};
Conn a;
Conn b = a;
```
::answer
UB: a rule-of-three violation. The implicit copy duplicates the pointer, so both destructors `delete[]` it: double free, UB. Delete the copy operations, implement them, or use `std::vector<int>`.
:::

:::bug{#U3 findings=ub}
```cpp run=none
struct Person {
    std::string name_;
    std::string& name() { return name_; }
};
Person make();
auto& n = make().name();
std::cout << n;
```
::answer
UB: `make()` returns a temporary that dies at the end of the full expression, so `n` dangles, and using it is undefined. Return by value, or ref-qualify: `const std::string& name() const&` and `std::string name() &&`.
:::

:::bug{#U4 findings=defined-bug}
```cpp run=none
class Socket {
    int fd_;
public:
    Socket(int fd) : fd_(fd) {}
    ~Socket() { ::close(fd_); }
};
void send_heartbeat(const Socket&);
// later:
send_heartbeat(3);
```
::answer
A defined bug, not UB, but a serious one: `3` converts to a temporary `Socket`, whose destructor closes file descriptor 3. Make the constructor `explicit` (and make `Socket` move-only).
:::
