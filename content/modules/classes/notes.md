### The special members

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

### Construction details

- **Initialization order is declaration order** of members (after bases), regardless of the order in the initializer list. `-Wreorder` warns.
- Use the initializer list, not assignment in the body: members are already default-constructed by the time the body runs. `const` members, reference members and members without a default constructor *must* be in the initializer list.
- `const` and reference members make the class non-assignable, which usually isn't what you want.
- Default member initializers (`int qty = 0;`) apply unless a constructor's initializer list overrides them.
- Delegating constructors call another constructor of the same class from the initializer list.

### Implicit conversions and `explicit`

A constructor callable with one argument is a converting constructor: `void send(Socket)` accepts `send(3)` if `Socket(int)` isn't `explicit`. Mark single-argument constructors and conversion operators `explicit` unless the conversion is genuinely lossless and expected (like `std::string` from `const char*`). C++20 adds `explicit(condition)`. An `explicit operator bool` still works in `if`, `while` and `!`.

### Assignment and copy-and-swap

A hand-written copy assignment must handle self-assignment and should give the strong exception guarantee. The copy-and-swap idiom does both: take the parameter by value (copy or move happens at the call site), then `swap(*this, other)` with a `noexcept` swap. It costs one extra move compared to an optimized hand-written version.

### Operator overloading

- Return types: `operator=` and compound assignments return `T&`. Prefix `++` returns `T&`; postfix `++(int)` returns the old value by value.
- Symmetric binary operators (`+`, `==`, `<`) should be non-members so conversions apply to both sides. The idiomatic form is a *hidden friend*: a `friend` defined inside the class, found only by ADL, which keeps overload sets small.
- Implement `+` in terms of `+=`.
- C++20: `auto operator<=>(const T&) const = default;` generates all ordering operators memberwise, and a defaulted `<=>` also declares a defaulted `==`. The compiler rewrites `a != b` as `!(a == b)` and `a < b` as `(a <=> b) < 0`, including reversed operands.
- Don't overload `&&`, `||` or `,`: overloads lose short-circuit evaluation (and before C++17, sequencing).

### Odds and ends

- `struct` and `class` differ only in default access (public vs private).
- A `const` member function promises not to change the observable state. `mutable` exempts members that aren't part of that state, like caches and mutexes.
- `static` data members belong to the class; `inline static int count = 0;` defines one in the class body (C++17).
- An empty class has `sizeof` 1 so distinct objects have distinct addresses. As a base class it can occupy zero bytes (empty base optimization); as a member it can too with `[[no_unique_address]]` (C++20).
- An *aggregate* is a class with no user-declared or inherited constructors, no private or protected direct non-static members, and no virtual functions. Aggregates support brace and designated initialization.
