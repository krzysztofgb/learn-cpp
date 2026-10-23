### The special members

Default constructor, destructor, copy constructor, copy assignment, move constructor, move assignment. What you declare changes what the compiler generates:

| You declare | Default ctor | Dtor | Copy ctor/assign | Move ctor/assign |
| --- | --- | --- | --- | --- |
| Nothing | Generated | Generated | Generated | Generated |
| Any constructor | Not generated | Generated | Generated | Generated |
| Destructor | Generated | Yours | Generated (deprecated) | **Not declared** (copies are used instead) |
| Copy ctor or copy assign | Not generated (ctor) / Generated | Generated | Yours + other generated (deprecated) | **Not declared** |
| Move ctor or move assign | Not generated (ctor) / Generated | Generated | **Deleted** | Yours; the other isn't declared |

The consequences that bite: adding an empty destructor silently turns every move into a copy, and declaring a move operation deletes copying. "Not declared" is different from "deleted": when the move constructor isn't declared, an rvalue argument binds to the copy constructor's `const T&` parameter instead, so `std::is_move_constructible_v<T>` is still true and `std::move` quietly copies.

A generated special member can also come out *defined as deleted* because of the members (\[class.copy.ctor\], \[class.copy.assign\]):

- A member that can't be copied (such as `std::unique_ptr`) deletes the implicit copy operations; moves still work.
- A reference member, or a `const` member, deletes the implicit copy and move *assignment*, while copy and move *construction* still work. Without a default member initializer, it also deletes the implicit default constructor (for `const` members, when the type has no default constructor of its own, as for `const int`).
- A generated move constructor is `noexcept` exactly when every member's and base's move constructor is.

- **Rule of zero:** hold resources in members that manage themselves (`std::vector`, `std::unique_ptr`) and declare none of the five. This is the default.
- **Rule of five:** if you must manage a resource by hand, declare all five (destructor, copy ctor, copy assign, move ctor, move assign), even if some are `= delete`.
- `= default` keeps a function trivial when possible, while an empty `{}` body never is. That matters for `memcpy`-ability and `std::is_trivially_copyable`.

*Further reading:* [Introduction to the copy constructor](https://www.learncpp.com/cpp-tutorial/introduction-to-the-copy-constructor/), [Move constructors and move assignment](https://www.learncpp.com/cpp-tutorial/move-constructors-and-move-assignment/), [Shallow vs. deep copying](https://www.learncpp.com/cpp-tutorial/shallow-vs-deep-copying/), [Destructors](https://www.learncpp.com/cpp-tutorial/destructors/)

### Construction details

- **Initialization order is declaration order** of members (after bases), regardless of the order in the initializer list. `-Wreorder` warns.
- Use the initializer list, not assignment in the body: members are already default-constructed by the time the body runs. `const` members, reference members and members without a default constructor *must* be in the initializer list.
- `const` and reference members make the class non-assignable, which usually isn't what you want.
- Default member initializers (`int qty = 0;`) apply unless a constructor's initializer list overrides them.
- Delegating constructors call another constructor of the same class from the initializer list.
- Reading a member in the initializer list before it has been initialized (because it's declared later) reads an indeterminate value: UB for scalars.
- **Guaranteed copy elision (C++17):** initializing an object from a prvalue of the same type, as in `T x = T();`, `T x = make();` or `return T{…};`, constructs it directly in its final place. No copy or move constructor runs, and none needs to exist. Initializing from an lvalue (`T b = a;`) calls the copy constructor, from `std::move(a)` the move constructor, and assigning to an existing object (`b = c;`) calls an assignment operator. Details in :mod[value-categories-and-moves].

*Further reading:* [Constructor member initializer lists](https://www.learncpp.com/cpp-tutorial/constructor-member-initializer-lists/), [Default member initialization](https://www.learncpp.com/cpp-tutorial/default-member-initialization/), [Delegating constructors](https://www.learncpp.com/cpp-tutorial/delegating-constructors/), [Class initialization and copy elision](https://www.learncpp.com/cpp-tutorial/class-initialization-and-copy-elision/)

### Implicit conversions and `explicit`

A constructor callable with one argument is a converting constructor: `void send(Socket)` accepts `send(3)` if `Socket(int)` isn't `explicit`. Mark single-argument constructors and conversion operators `explicit` unless the conversion is genuinely lossless and expected (like `std::string` from `const char*`). C++20 adds `explicit(condition)`. An `explicit operator bool` still works in `if`, `while` and `!`. An `explicit` constructor is still used by direct initialization (`Qty q(42);`, `Qty{42}`, `static_cast<Qty>(42)`), just never for an implicit conversion such as passing `42` to a `Qty` parameter. Watch converting constructors on resource types especially: the temporary they create is destroyed at the end of the full-expression, and its destructor releases whatever it was given.

*Further reading:* [Converting constructors and the explicit keyword](https://www.learncpp.com/cpp-tutorial/converting-constructors-and-the-explicit-keyword/), [Overloading typecasts](https://www.learncpp.com/cpp-tutorial/overloading-typecasts/)

### Assignment and copy-and-swap

A hand-written copy assignment must handle self-assignment and should give the strong exception guarantee. The usual mistakes are freeing the old buffer before copying from `other` (when `other` is `*this`, the source is gone) and freeing before allocating (if `new` throws, the object is left holding a dangling pointer). Allocate and copy into a new buffer first, then free the old one, or: The copy-and-swap idiom does both: take the parameter by value (copy or move happens at the call site), then `swap(*this, other)` with a `noexcept` swap. It costs one extra move compared to an optimized hand-written version.

`std::swap(a, b)` without a custom overload does one move construction and two move assignments (`T tmp = std::move(a); a = std::move(b); b = std::move(tmp);`). A move assignment should also survive self-move (`a = std::move(a)`) by leaving the object valid, even if its value is unspecified.

*Further reading:* [Overloading the assignment operator](https://www.learncpp.com/cpp-tutorial/overloading-the-assignment-operator/)

### Operator overloading

- Return types: `operator=` and compound assignments return `T&`. Prefix `++` returns `T&`; postfix `++(int)` returns the old value by value.
- Symmetric binary operators (`+`, `==`, `<`) should be non-members so conversions apply to both sides. The idiomatic form is a *hidden friend*: a `friend` defined inside the class, found only by ADL, which keeps overload sets small.
- Implement `+` in terms of `+=`.
- C++20: `auto operator<=>(const T&) const = default;` generates all ordering operators memberwise, and a defaulted `<=>` also declares a defaulted `==`. The compiler rewrites `a != b` as `!(a == b)` and `a < b` as `(a <=> b) < 0`, including reversed operands.
- Don't overload `&&`, `||` or `,`: overloads lose short-circuit evaluation (and before C++17, sequencing).
- To make a type work with `std::format` (C++20), specialize `std::formatter<T>` with a `parse` member (often inherited by deriving from an existing formatter such as `std::formatter<std::string_view>`) and a `format` member that writes through the context's output iterator.

*Further reading:* [Introduction to operator overloading](https://www.learncpp.com/cpp-tutorial/introduction-to-operator-overloading/), [Overloading the arithmetic operators using friend functions](https://www.learncpp.com/cpp-tutorial/overloading-the-arithmetic-operators-using-friend-functions/), [Overloading the comparison operators](https://www.learncpp.com/cpp-tutorial/overloading-the-comparison-operators/), [Overloading the increment and decrement operators](https://www.learncpp.com/cpp-tutorial/overloading-the-increment-and-decrement-operators/)

### Odds and ends

- `struct` and `class` differ only in default access (public vs private).
- A `const` member function promises not to change the observable state. `mutable` exempts members that aren't part of that state, like caches and mutexes.
- `static` data members belong to the class; `inline static int count = 0;` defines one in the class body (C++17).
- Layout: each member sits at an offset that's a multiple of its alignment, and the class's size is rounded up to a multiple of its strictest member's alignment, so padding appears between and after members (:mod[raw-memory]). A 1-byte member followed by an `int` costs 4 bytes, not 1.
- An empty class has `sizeof` 1 so distinct objects have distinct addresses. As a base class it can occupy zero bytes (empty base optimization); as a member it can too with `[[no_unique_address]]` (C++20).
- An *aggregate* is a class with no user-declared or inherited constructors, no private or protected direct non-static members, and no virtual functions. Aggregates support brace and designated initialization.
- **Ref-qualifiers** overload a member function on the value category of the object: `const std::string& name() const&` runs on lvalues, `std::string name() &&` on rvalues (temporaries), where it can return by value or move out. A temporary is destroyed at the end of the full-expression that created it, so a reference returned from a member of a temporary dangles after the `;` (:mod[object-lifetime]).
- **One body for `const` and non-`const` accessors:** C++23's *deducing `this`* makes the object an explicit parameter, `template <class Self> auto& get(this Self& self)`, whose type carries the `const`. The classic alternative writes the `const` version and has the non-`const` one call it and `const_cast` the result. C++23 also allows a multidimensional subscript, `operator[](std::size_t r, std::size_t c)`.

*Further reading:* [Public and private members and access specifiers](https://www.learncpp.com/cpp-tutorial/public-and-private-members-and-access-specifiers/), [Const class objects and const member functions](https://www.learncpp.com/cpp-tutorial/const-class-objects-and-const-member-functions/), [Static member variables](https://www.learncpp.com/cpp-tutorial/static-member-variables/), [Ref qualifiers](https://www.learncpp.com/cpp-tutorial/ref-qualifiers/)
