# Module 6: Polymorphism

Interviewers at trading firms ask how virtual dispatch works at the machine level and what it costs, because the answer decides whether it belongs on a hot path. Go interfaces are a useful comparison: Go stores the method table in the interface value (a fat pointer); C++ stores a pointer to it inside every object.

## Notes

### 6.1 How virtual dispatch is implemented

The standard doesn't specify it, but every mainstream ABI (Itanium on Linux and macOS, MSVC on Windows) does the same thing:

- Each polymorphic class has one *vtable*: an array of function pointers, plus the RTTI pointer and an offset-to-top used for casts.
- Each object of a polymorphic class holds a hidden *vptr*, usually its first 8 bytes, pointing at its class's vtable.
- A virtual call loads the vptr, loads the function pointer at a fixed slot, and makes an indirect call.

The costs: one or two dependent loads (possible cache misses), an indirect branch the CPU must predict, and, most importantly, the call usually can't be inlined, which blocks the optimizations inlining enables. A well-predicted virtual call in a hot loop costs a few nanoseconds; an unpredictable one costs a branch mispredict (\~15–20 cycles) each time.

**Devirtualization:** the compiler can call directly when it knows the dynamic type: the class or function is `final`, the object is a local of known type, or LTO sees the whole hierarchy. Mark leaf classes `final`.

### 6.2 Rules that bite

- **Slicing:** copying a derived object into a base object by value copies only the base part. The vptr is the base's, so virtual calls go to base versions.
- **Virtual destructor:** deleting a derived object through a base pointer without a virtual destructor is UB. Polymorphic bases need either a public virtual destructor or a protected non-virtual one.
- **Virtual calls in constructors and destructors** dispatch to the class currently being constructed or destroyed, because the vptr is set progressively, base first. Calling a pure virtual function this way is UB (usually an abort with "pure virtual method called").
- **`override`** makes the compiler check that you're actually overriding. A mismatched signature without it silently declares a new function that hides the base one.
- **Default arguments** come from the static type (Module 3).
- A pure virtual function can still have a definition, and a pure virtual destructor *must* have one.
- A private virtual function can be overridden; that's the non-virtual interface (NVI) pattern: public non-virtual functions call private virtual hooks.
- Virtual functions can't be templates.

### 6.3 Multiple and virtual inheritance

With `struct Z : X, Y`, a `Z` contains an `X` subobject and a `Y` subobject, each with its own vptr. Converting `Z*` to `Y*` adjusts the pointer value by the offset of `Y` inside `Z`, and calls through `Y`'s vtable go through *thunks* that adjust `this` back.

In a diamond (`L : Top`, `R : Top`, `Bot : L, R`), `Bot` contains two `Top` subobjects, and unqualified access to `Top`'s members is ambiguous. `virtual` inheritance (`L : virtual Top`) shares one `Top`, at the cost of an extra indirection to find it, and the *most-derived* class constructs the virtual base, ignoring the intermediate classes' initializers.

### 6.4 Casts and RTTI

- `static_cast` downcast: no check. If the object isn't actually of that type, it's UB.
- `dynamic_cast` downcast: checked using RTTI. Returns `nullptr` for pointers, throws `std::bad_cast` for references. It needs a polymorphic source type and costs a hierarchy walk (sometimes string comparisons across shared libraries). Frequent `dynamic_cast` suggests a missing virtual function or a `std::variant`.
- `typeid(expr)` gives the dynamic type for polymorphic lvalues.
- Many low-latency codebases build with `-fno-rtti`, which disables `dynamic_cast` and `typeid` on polymorphic types.

### 6.5 Alternatives to virtual dispatch

| Technique | Dispatch | Open to new types? | Typical use |
| --- | --- | --- | --- |
| Virtual functions | Runtime, indirect call | Yes | Plugin-style hierarchies |
| Templates / CRTP (Module 15) | Compile time, inlinable | Yes, at compile time | Hot paths with known types |
| `std::variant` + `visit` (Module 13) | Runtime, jump table or `switch` | No, closed set | Message types, events |
| Type erasure (`std::function`) | Runtime, indirect call | Yes | Callbacks with value semantics |

In a market data handler, the set of message types is closed and known at compile time, so `variant` or a `switch` on a type byte usually beats a virtual hierarchy.

## Predict the output

**P1**

```cpp kind=fragment run=local
struct A { virtual const char* name() const { return "A"; } };
struct B : A { const char* name() const override { return "B"; } };
void by_val(A a)        { cout << a.name(); }
void by_ref(const A& a) { cout << a.name(); }
B b; by_val(b); by_ref(b);
```

**P2**

```cpp kind=fragment run=local
struct Base {
    Base() { hello(); }
    virtual void hello() { cout << "Base "; }
};
struct Der : Base { void hello() override { cout << "Der "; } };
Der d; d.hello();
```

**P3**

```cpp kind=fragment run=local note="In the browser this is wasm32, where `long` and pointers are 32-bit: the vptr is 4 bytes, so this prints 1 4 8."
struct E {};
struct V { virtual ~V() = default; };
struct VI : V { int x; };
cout << sizeof(E) << ' ' << sizeof(V) << ' ' << sizeof(VI);
```

**P4**

```cpp kind=fragment run=local
struct X { int x; virtual ~X() = default; };
struct Y { int y; virtual ~Y() = default; };
struct Z : X, Y {};
Z z;
X* px = &z; Y* py = &z;
cout << (static_cast<void*>(px) == static_cast<void*>(&z))
     << (static_cast<void*>(py) == static_cast<void*>(&z))
     << (py == &z);
```

**P5**

```cpp kind=fragment run=local
struct Top { Top() { cout << 'T'; } };
struct L : Top {};
struct R : Top {};
struct Bot : L, R {};
Bot b;
```

(And with `struct L : virtual Top` and `struct R : virtual Top`?)

**P6**

```cpp kind=fragment run=local
struct A { virtual void f(int)    { cout << "A::f(int) "; } };
struct B : A { virtual void f(double) { cout << "B::f(double) "; } };
B b; A& a = b;
a.f(1); b.f(1);
```

## Spot the UB

**U1**

```cpp kind=fragment run=local
struct Order { ~Order() {} };
struct LimitOrder : Order { std::string tag; };
Order* o = new LimitOrder;
delete o;
```

**U2**

```cpp kind=fragment run=local
struct Msg { virtual ~Msg() = default; };
struct Trade : Msg { int px; };
struct Quote : Msg { int bid, ask; };
Msg* m = new Quote;
int p = static_cast<Trade*>(m)->px;
```

**U3**

```cpp kind=fragment run=local
struct Handler {
    Handler() { init(); }
    void init() { setup(); }
    virtual void setup() = 0;
};
```

**U4**

```cpp kind=fragment run=local
struct Widget {
    virtual void draw();
    int x, y;
    Widget() { std::memset(this, 0, sizeof(*this)); }
};
```

**U5**

```cpp kind=fragment run=none
struct Base { virtual void f(); virtual ~Base() = default; int a; };
struct Derived : Base { int b; };
Base* arr = new Derived[10];
arr[1].f();
delete[] arr;
```

## Exercises

**E1 ★ See the layout.** Compile a small hierarchy with `clang++ -Xclang -fdump-record-layouts` and `-Xclang -fdump-vtable-layouts`. Annotate where the vptr sits, what each vtable slot holds, and how multiple inheritance adds a second vptr.

**E2 ★★ Dispatch benchmark.** Sum `area()` over 1M shapes of 3 kinds using: virtual calls, `std::variant` + `std::visit`, a `switch` on a type tag, and separate arrays per type. Run each with the objects sorted by type and shuffled. Explain the results in terms of branch prediction and inlining.

**E3 ★★ Hand-rolled vtable.** Implement `Shape` polymorphism in C style: a struct holding a pointer to a static table of function pointers, plus the object data. Then implement Go-style interfaces: a fat pointer `{data*, table*}` that can wrap any type with `area()`. Compare `sizeof` and call sequences.

**E4 ★★ Diamond construction.** Build a virtual-inheritance diamond where each class prints and takes a constructor argument. Show that the most-derived class's initializer for the virtual base is the one used, and what happens if it doesn't provide one.

**E5 ★★★ Type erasure.** Implement `AnyShape`, a value type that holds any object with `double area() const` without requiring inheritance, using an internal concept/model pair (Sean Parent style). Add a 32-byte small buffer so small shapes don't allocate. Count allocations to prove it.

## Interview questions

1. How are virtual functions implemented? Draw the object and vtable layout.
2. What does a virtual call cost, and why is the lack of inlining the biggest cost?
3. When can the compiler devirtualize a call?
4. Why do polymorphic base classes need a virtual destructor?
5. What is object slicing?
6. What happens when you call a virtual function from a constructor?
7. What's the diamond problem? How does virtual inheritance solve it, and what does it cost?
8. `dynamic_cast` vs `static_cast` for downcasting: cost and safety?
9. Can a member function template be virtual? Why not?
10. Compare C++ virtual functions with Go interfaces.
11. When would you choose `std::variant`, CRTP or virtual functions?

## Answer key

### Predict the output

| # | Output | Why |
| --- | --- | --- |
| P1 | `AB` | `by_val` slices to an `A`; `by_ref` dispatches on the real `B`. |
| P2 | ` Base Der  ` | During `Base`'s constructor the object is a `Base`. |
| P3 | `1 8 16` | The vptr takes 8 bytes; `int x` plus padding rounds to 16. |
| P4 | `101` | `X` is at offset 0, `Y` at offset 16. `py == &z` converts `&z` to `Y*` first, so it's true. |
| P5 | `TT`; with virtual: `T` | Without `virtual` there are two `Top` subobjects. |
| P6 | ` A::f(int) B::f(double)  ` | `B::f(double)` doesn't override `A::f(int)`; it hides it. Through `A&` only `A::f(int)` is a candidate. |

### Spot the UB

- **U1:** UB: deleting a `LimitOrder` through `Order*` without a virtual destructor. In practice `tag` leaks. Add `virtual ~Order() = default;`.
- **U2:** UB: a `static_cast` downcast to the wrong dynamic type. Use `dynamic_cast` and check, or a type tag.
- **U3:** UB: `init()` indirectly calls the pure virtual `setup()` during construction. Typically aborts with "pure virtual method called". Use a factory that calls `setup()` after construction.
- **U4:** UB: the class isn't trivially copyable, and `memset` overwrites the vptr. Use default member initializers.
- **U5:** UB twice. `arr[1]` uses `sizeof(Base)` for pointer arithmetic, landing inside the first `Derived`. `delete[]` through a base pointer is UB even with a virtual destructor. Never treat arrays polymorphically; use `std::vector<std::unique_ptr<Base>>`.

### Exercise hints

- **E2:** With shuffled objects, the indirect branch is unpredictable for virtual calls, and the `variant` jump table is unpredictable too. Sorting by type makes both predictable. Separate arrays per type let the compiler inline and vectorize, and usually win by a wide margin.
- **E3:** C++ objects are one pointer larger (the vptr), but references to them are thin. Go objects are smaller, but interface values are two pointers.
- **E4:** If the most-derived class doesn't name the virtual base, its default constructor is used even if `L` and `R` pass arguments.

### Interview questions

1. Each object holds a vptr to its class's vtable of function pointers; a call loads the vptr, loads the slot, and calls indirectly. See 6.1.
2. Two dependent loads and an indirect branch, a few ns when predicted. The bigger cost is that the callee can't be inlined, so constant propagation, vectorization and dead-code elimination across the call are lost.
3. When the dynamic type is provably known: `final` classes or functions, objects of known concrete type, or whole-program knowledge through LTO. Speculative devirtualization with a type check is also possible.
4. Otherwise `delete base_ptr` calls only the base destructor, which is UB; in practice derived members leak.
5. Copying a derived object into a base object by value, which keeps only the base subobject and the base vptr.
6. It calls the version from the class whose constructor is running. If that version is pure virtual, the behavior is undefined.
7. A class inherits the same base twice through two paths, creating duplicate subobjects and ambiguous member access. Virtual inheritance shares one subobject, adding an indirection (a virtual base offset) and making the most-derived class responsible for constructing it.
8. `static_cast` is free but UB if wrong. `dynamic_cast` is checked but walks RTTI at runtime and requires RTTI enabled.
9. No. The vtable needs a fixed set of slots, and a template has an unbounded set of instantiations.
10. Both are runtime dispatch through tables of function pointers. C++ is nominal (explicit inheritance) and puts the vptr in every object; Go is structural and puts the table pointer in the interface value. Go builds the table pairing (itab) per type-interface pair, lazily.
11. Variant for a closed set of types where you want value semantics and no allocation; CRTP or templates when types are known at compile time and the call must inline; virtual functions for open hierarchies where flexibility matters more than nanoseconds.
