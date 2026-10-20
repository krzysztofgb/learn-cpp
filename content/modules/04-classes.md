# Module 4: Classes

The compiler writes up to six member functions for you, and the rules for when it does are the most asked class-design question in C++ interviews. Get them exact.

## Notes

### 4.1 The special members

Default constructor, destructor, copy constructor, copy assignment, move constructor, move assignment. What you declare changes what the compiler generates:

| You declare | Default ctor | Dtor | Copy ctor/assign | Move ctor/assign |
| --- | --- | --- | --- | --- |
| Nothing | Generated | Generated | Generated | Generated |
| Any constructor | Not generated | Generated | Generated | Generated |
| Destructor | Generated | Yours | Generated (deprecated) | **Not declared** (copies are used instead) |
| Copy ctor or copy assign | Not generated (ctor) / Generated | Generated | Yours + other generated (deprecated) | **Not declared** |
| Move ctor or move assign | Not generated (ctor) / Generated | Generated | **Deleted** | Yours; the other isn't declared |

The consequences that bite: adding an empty destructor silently turns every move into a copy, and declaring a move operation deletes copying.

- **Rule of zero:** hold resources in members that manage themselves (`std::vector`, `std::unique_ptr`) and declare none of the five. This is the default.
- **Rule of five:** if you must manage a resource by hand, declare all five (destructor, copy ctor, copy assign, move ctor, move assign), even if some are `= delete`.
- `= default` keeps a function trivial when possible, while an empty `{}` body never is. That matters for `memcpy`-ability and `std::is_trivially_copyable`.

### 4.2 Construction details

- **Initialization order is declaration order** of members (after bases), regardless of the order in the initializer list. `-Wreorder` warns.
- Use the initializer list, not assignment in the body: members are already default-constructed by the time the body runs. `const` members, reference members and members without a default constructor *must* be in the initializer list.
- `const` and reference members make the class non-assignable, which usually isn't what you want.
- Default member initializers (`int qty = 0;`) apply unless a constructor's initializer list overrides them.
- Delegating constructors call another constructor of the same class from the initializer list.

### 4.3 Implicit conversions and `explicit`

A constructor callable with one argument is a converting constructor: `void send(Socket)` accepts `send(3)` if `Socket(int)` isn't `explicit`. Mark single-argument constructors and conversion operators `explicit` unless the conversion is genuinely lossless and expected (like `std::string` from `const char*`). C++20 adds `explicit(condition)`. An `explicit operator bool` still works in `if`, `while` and `!`.

### 4.4 Assignment and copy-and-swap

A hand-written copy assignment must handle self-assignment and should give the strong exception guarantee. The copy-and-swap idiom does both: take the parameter by value (copy or move happens at the call site), then `swap(*this, other)` with a `noexcept` swap. It costs one extra move compared to an optimized hand-written version.

### 4.5 Operator overloading

- Return types: `operator=` and compound assignments return `T&`. Prefix `++` returns `T&`; postfix `++(int)` returns the old value by value.
- Symmetric binary operators (`+`, `==`, `<`) should be non-members so conversions apply to both sides. The idiomatic form is a *hidden friend*: a `friend` defined inside the class, found only by ADL, which keeps overload sets small.
- Implement `+` in terms of `+=`.
- C++20: `auto operator<=>(const T&) const = default;` generates all ordering operators memberwise, and a defaulted `<=>` also declares a defaulted `==`. The compiler rewrites `a != b` as `!(a == b)` and `a < b` as `(a <=> b) < 0`, including reversed operands.
- Don't overload `&&`, `||` or `,`: overloads lose short-circuit evaluation (and before C++17, sequencing).

### 4.6 Odds and ends

- `struct` and `class` differ only in default access (public vs private).
- A `const` member function promises not to change the observable state. `mutable` exempts members that aren't part of that state, like caches and mutexes.
- `static` data members belong to the class; `inline static int count = 0;` defines one in the class body (C++17).
- An empty class has `sizeof` 1 so distinct objects have distinct addresses. As a base class it can occupy zero bytes (empty base optimization); as a member it can too with `[[no_unique_address]]` (C++20).
- An *aggregate* is a class with no user-declared or inherited constructors, no private or protected direct non-static members, and no virtual functions. Aggregates support brace and designated initialization.

## Predict the output

**P1**

```cpp kind=fragment run=local
struct S {
    int a, b;
    S(int x) : b(x), a(b + 1) {}
};
S s(5);
cout << s.a;
```

**P2**

```cpp kind=fragment run=local
struct W {
    W() { cout << "D "; }
    W(const W&) { cout << "C "; }
    W(W&&) { cout << "M "; }
    W& operator=(const W&) { cout << "CA "; return *this; }
};
W a;
W b = a;
W c(std::move(a));
b = c;
W d = W();
```

**P3**

```cpp kind=fragment run=local
struct Qty { Qty(int v) : v(v) {} int v; };
void place(Qty q) { cout << q.v; }
place(42);
```

(What changes if the constructor is `explicit`?)

**P4**

```cpp kind=fragment run=local
struct E {};
struct A { E e; int x; };
struct B { [[no_unique_address]] E e; int x; };
struct C : E { int x; };
cout << sizeof(E) << sizeof(A) << sizeof(B) << sizeof(C);
```

**P5**

```cpp kind=fragment run=local
struct T {
    ~T() {}
    std::vector<int> v;
};
T a;
a.v = {1, 2, 3};
T b = std::move(a);
cout << a.v.size();
```

**P6**

```cpp kind=fragment run=local
struct S {
    int x = 1;
    S() : x(2) {}
    S(int) {}
};
cout << S().x << S(0).x;
```

## Spot the bug or UB

**U1**

```cpp kind=fragment run=local
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

**U2**

```cpp kind=fragment run=local
class Conn {
    int* fds_ = new int[64];
public:
    ~Conn() { delete[] fds_; }
};
Conn a;
Conn b = a;
```

**U3**

```cpp kind=fragment run=none
struct Person {
    std::string name_;
    std::string& name() { return name_; }
};
Person make();
auto& n = make().name();
std::cout << n;
```

**U4**

```cpp kind=fragment run=none
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

## Exercises

**E1 ★ Noisy class.** Write `Noisy`, which prints from all six special members. Write 10 statements (pass by value, return by value, `std::vector::push_back` with and without `reserve`, `std::swap`) and predict the output before running.

**E2 ★★ `String` by hand.** Implement an owning `String` with a heap buffer: all five special members, copy-and-swap assignment, `noexcept` move, `size`, `c_str` and `operator+=`. Test self-assignment and self-move under ASan.

**E3 ★★ `Price` type.** Implement `Price` holding `int64_t` ticks: `explicit` constructor, defaulted `<=>`, `+`, `-` and `*` by an integer as hidden friends, and `std::formatter` support so `std::format("{}", p)` prints a decimal string. Ensure `Price + int` doesn't compile.

**E4 ★★ Special member detective.** For six class definitions (a `unique_ptr` member, a user destructor, a user copy constructor, a `const` member, a reference member, a user move constructor), predict `is_default_constructible`, `is_copy_constructible`, `is_copy_assignable`, `is_move_constructible` and `is_nothrow_move_constructible`. Verify each with `static_assert`.

**E5 ★★★ Deduplicated accessors.** Write a `Grid` class with `operator[](std::size_t r, std::size_t c)` (C++23 multidimensional subscript). Provide the `const` and non-`const` versions with one function body using deducing `this`, then compare with the classic `const_cast` trick.

## Interview questions

1. Explain the rule of zero, three and five.
2. When does the compiler generate a move constructor? What happens if you add an empty destructor?
3. In what order are members initialized? Why does it matter?
4. Why use the initializer list instead of assigning in the constructor body?
5. What does `explicit` prevent? Give a bug it stops.
6. What is copy-and-swap, and what guarantees does it give?
7. Why are `==` and `+` usually non-members? What's a hidden friend?
8. What does `mutable` do, and when is it legitimate?
9. What's the difference between `struct` and `class`?
10. What's the size of an empty class, and what are EBO and `[[no_unique_address]]`?
11. What does a defaulted `operator<=>` give you?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | UB (garbage) | `a` is declared first, so it's initialized first, from `b`, which isn't initialized yet. |
| P2 | ` D C M CA D  ` | `W d = W();` uses guaranteed copy elision: one default construction, no move. |
| P3 | `42` | `Qty(int)` converts implicitly. With `explicit`, `place(42)` fails to compile; write `place(Qty{42})`. |
| P4 | `1844` | `A` pads the 1-byte `E` member to 4. `[[no_unique_address]]` and EBO let `E` take no space. |
| P5 | `3` | The user-declared destructor suppresses the implicit move constructor, so `std::move(a)` copies. |
| P6 | `21` | A constructor's initializer list overrides the default member initializer; `S(int)` falls back to it. |

### Spot the bug or UB

- **U1:** On self-assignment, o.data\_ is data\_, so after the delete and the new allocation, memcpy copies the fresh uninitialized buffer onto itself: the original contents are silently lost. That memcpy is also formally UB, because its source and destination overlap (they're identical). It's also not exception-safe: if `new` throws, `data_` dangles. Use copy-and-swap, or allocate and copy before deleting.
- **U2:** Rule-of-three violation. The implicit copy duplicates the pointer, so both destructors `delete[]` it: double free, UB. Delete the copy operations, implement them, or use `std::vector<int>`.
- **U3:** `make()` returns a temporary that dies at the end of the full expression, so `n` dangles. Using it is UB. Return by value, or ref-qualify: `const std::string& name() const&` and `std::string name() &&`.
- **U4:** No UB, but a serious bug: `3` converts to a temporary `Socket`, whose destructor closes file descriptor 3. Make the constructor `explicit` (and make `Socket` move-only).

### Exercise hints

- **E1:** `push_back` without `reserve` reallocates and copies the existing elements unless the move constructor is `noexcept` (Module 7).
- **E4:** A reference or `const` member deletes copy and move *assignment* but not construction. A user copy constructor means no implicit move, but the type still reports move-constructible because `T&&` binds to `const T&`.

### Interview questions

1. Zero: let members manage resources, declare no special members. Three (pre-C++11): if you need a destructor, copy constructor or copy assignment, you need all three. Five: add move constructor and move assignment.
2. Only if the class has no user-declared copy operations, copy assignment, move assignment or destructor. An empty destructor suppresses it, so moves become copies, which is a silent performance bug.
3. Bases in declaration order, then members in declaration order, regardless of the initializer list. Initializing one member from another declared later reads an uninitialized value.
4. Members are default-constructed before the body runs, so assignment does the work twice. `const` members, references and types without default constructors can only be set in the list.
5. Implicit conversions through single-argument constructors or conversion operators. The `Socket(int)` example closes a file descriptor through an accidental temporary.
6. Take the argument by value and swap with it. It handles self-assignment, reuses the copy and move constructors, and gives the strong guarantee, at the cost of an extra move.
7. So implicit conversions apply to both operands symmetrically. A hidden friend is a `friend` function defined inside the class; it's only found through ADL, keeping it out of unrelated overload sets.
8. It lets a `const` member function modify that member. It's legitimate for state that doesn't affect observable value: caches, mutexes, statistics counters.
9. Only the default access for members and bases: public for `struct`, private for `class`.
10. At least 1, so distinct objects have distinct addresses. As a base, an empty class can take zero bytes (EBO). `[[no_unique_address]]` gives members the same ability. This matters for stateless allocators and deleters.
11. All six relational operators via memberwise lexicographic comparison in declaration order, plus a defaulted `==`, with reversed-operand rewrites.
