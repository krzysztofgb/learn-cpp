### How virtual dispatch is implemented

The standard doesn't specify it, but every mainstream ABI (Itanium on Linux and macOS, MSVC on Windows) does the same thing:

- Each polymorphic class has one *vtable*: an array of function pointers, plus the RTTI pointer and an offset-to-top used for casts.
- Each object of a polymorphic class holds a hidden *vptr*, usually its first 8 bytes, pointing at its class's vtable.
- A virtual call loads the vptr, loads the function pointer at a fixed slot, and makes an indirect call.

The vptr is an ordinary pointer member as far as layout goes: it adds pointer size to every object and gives the class at least pointer alignment, so `sizeof` rounds up to a multiple of it (:sec[raw-memory/alignment-and-layout]). A class with no members still has `sizeof` 1, and an empty base can take zero bytes (:sec[classes/odds-and-ends]).

The costs: one or two dependent loads (possible cache misses), an indirect branch the CPU must predict, and, most importantly, the call usually can't be inlined, which blocks the optimizations inlining enables. A well-predicted virtual call in a hot loop costs a few nanoseconds; an unpredictable one costs a branch mispredict (\~15–20 cycles) each time.

**Devirtualization:** the compiler can call directly when it knows the dynamic type: the class or function is `final`, the object is a local of known type, or LTO sees the whole hierarchy. It can also devirtualize *speculatively*: compare the loaded function pointer (or vptr) with the likely target, call that target directly (and inline it) on a match, and fall back to the indirect call otherwise. Mark leaf classes `final`.

> **Coming from Go?** A Go interface value is a fat pointer, a data pointer plus a pointer to a method table, so the object itself carries no table pointer. C++ puts the table pointer inside every object instead: objects are one pointer larger, but pointers and references to them are thin.

*Further reading:* [Virtual functions and polymorphism](https://www.learncpp.com/cpp-tutorial/virtual-functions/), [The virtual table](https://www.learncpp.com/cpp-tutorial/the-virtual-table/)

### Rules that bite

- **Slicing:** copying a derived object into a base object by value copies only the base part. The vptr is the base's, so virtual calls go to base versions.
- **Virtual destructor:** deleting a derived object through a base pointer without a virtual destructor is UB. Polymorphic bases need either a public virtual destructor or a protected non-virtual one.
- **Virtual calls in constructors and destructors** dispatch to the class currently being constructed or destroyed, because the vptr is set progressively, base first. That holds whether the call is direct or made through a non-virtual helper. Calling a pure virtual function this way is UB (usually an abort with "pure virtual method called").
- **Name hiding:** a member named `f` in a derived class hides *every* base member named `f`, whatever its parameters, because name lookup stops at the first class scope that declares the name, and only then does overload resolution pick among what was found \[class.member.lookup\]. So `D::f(double)` doesn't override `B::f(int)`: through a `B&` lookup finds only `B`'s `f`, and through a `D` it finds only `D`'s, converting arguments as needed. `using B::f;` inside `D` brings the base overloads back into the set.
- **`override`:** an override must match the base function's name, parameter types and cv/ref qualifiers (the return type may be covariant). `override` makes the compiler check that you're actually overriding; without it, a mismatched signature silently declares a new function that hides the base one.
- **Default arguments** come from the static type (:mod[compilation-model]).
- A pure virtual function can still have a definition, and a pure virtual destructor *must* have one.
- A private virtual function can be overridden; that's the non-virtual interface (NVI) pattern: public non-virtual functions call private virtual hooks.
- **Virtual functions can't be templates:** a class's vtable has a fixed set of slots, decided when the class is defined, while a member function template has an unbounded set of instantiations. A virtual function in a class template is fine, since each instantiated class gets its own vtable.
- **No `memset` or `memcpy` on polymorphic objects:** a class with virtual functions or virtual bases is not trivially copyable, because the vptr is state the constructor sets up. Zeroing or byte-copying the object overwrites the vptr, and the next virtual call jumps through garbage. Initialize members with default member initializers or a constructor.
- **Arrays aren't polymorphic:** `p[i]` advances by `sizeof` of `p`'s static type, so a `Base*` into an array of larger `Derived` objects lands mid-object from `p[1]` on. And `delete[]` through a pointer whose static type differs from the elements' dynamic type is UB even with a virtual destructor \[expr.delete\]. Hold polymorphic objects in a container of (smart) pointers.

*Further reading:* [Object slicing](https://www.learncpp.com/cpp-tutorial/object-slicing/), [Virtual destructors, virtual assignment, and overriding virtualization](https://www.learncpp.com/cpp-tutorial/virtual-destructors-virtual-assignment-and-overriding-virtualization/), [Pure virtual functions, abstract base classes, and interface classes](https://www.learncpp.com/cpp-tutorial/pure-virtual-functions-abstract-base-classes-and-interface-classes/), [Hiding inherited functionality](https://www.learncpp.com/cpp-tutorial/hiding-inherited-functionality/)

### Multiple and virtual inheritance

With `struct Z : X, Y`, a `Z` contains an `X` subobject and a `Y` subobject, each with its own vptr. In practice the first polymorphic base sits at offset 0 and the next one follows it, padded to its alignment. Converting `Z*` to `Y*` adjusts the pointer value by the offset of `Y` inside `Z`, and calls through `Y`'s vtable go through *thunks* that adjust `this` back.

Comparing pointers of different class types first converts them to a common type, with the same adjustment: `py == &z` converts `&z` to `Y*`, so the two compare equal even though `py` and `&z` hold different addresses. Cast both sides to `void*` to compare the raw addresses (`dynamic_cast<void*>(p)` gives the address of the most-derived object).

In a diamond (`L : Top`, `R : Top`, `Bot : L, R`), `Bot` contains two `Top` subobjects, each constructed through its own path, and unqualified access to `Top`'s members is ambiguous. `virtual` inheritance (`L : virtual Top`) shares one `Top`, at the cost of an extra indirection to find it (the virtual base's offset is stored in the vtable).

Virtual bases are constructed first, before any non-virtual base, and by the *most-derived* class only: the `Top(...)` initializers in `L`'s and `R`'s constructors are ignored when constructing a `Bot`. If `Bot`'s constructor doesn't name `Top` in its member initializer list, `Top` is default-constructed (a compile error if it has no default constructor).

*Further reading:* [Multiple inheritance](https://www.learncpp.com/cpp-tutorial/multiple-inheritance/), [Virtual base classes](https://www.learncpp.com/cpp-tutorial/virtual-base-classes/)

### Casts and RTTI

- `static_cast` downcast: no check. If the object isn't actually of that type, it's UB.
- `dynamic_cast` downcast: checked using RTTI. Returns `nullptr` for pointers, throws `std::bad_cast` for references. It needs a polymorphic source type and costs a hierarchy walk (sometimes string comparisons across shared libraries). Frequent `dynamic_cast` suggests a missing virtual function or a `std::variant`.
- `typeid(expr)` gives the dynamic type for polymorphic lvalues.
- Many low-latency codebases build with RTTI off (`-fno-rtti` on GCC and Clang, `/GR-` on MSVC), which disables `dynamic_cast` and `typeid` on polymorphic types.

*Further reading:* [Dynamic casting](https://www.learncpp.com/cpp-tutorial/dynamic-casting/)

### Alternatives to virtual dispatch

| Technique | Dispatch | Open to new types? | Typical use |
| --- | --- | --- | --- |
| Virtual functions | Runtime, indirect call | Yes | Plugin-style hierarchies |
| Templates / CRTP (:mod[metaprogramming]) | Compile time, inlinable | Yes, at compile time | Hot paths with known types |
| `std::variant` + `visit` (:mod[utilities]) | Runtime, jump table or `switch` | No, closed set | Message types, events |
| Type erasure (`std::function`) | Runtime, indirect call | Yes | Callbacks with value semantics |

In a market data handler, the set of message types is closed and known at compile time, so `variant` or a `switch` on a type byte usually beats a virtual hierarchy. Whether a jump table or an indirect call, a runtime dispatch is cheap when the same target repeats (objects sorted by type) and pays a mispredict when the target changes unpredictably. Keeping one array per concrete type removes the dispatch from the loop entirely, so the compiler can inline and vectorize.

**Type erasure** gives runtime polymorphism over types that share no base class. The usual shape (Sean Parent's concept/model):

- a private abstract `Concept` with the operations as pure virtual functions, plus `clone()` for copying;
- a class template `Model<T> : Concept` that holds a `T` and forwards each operation to it;
- a value-type wrapper holding a pointer to a `Concept`, with a constructor template that accepts any `T` and creates a `Model<T>`. Copying the wrapper calls `clone()`.

A *small-buffer optimization* stores the `Model<T>` inside the wrapper, in an aligned byte buffer, with placement new (:mod[raw-memory]) when it fits and its move is `noexcept`, and allocates only for larger types. `std::function` works this way. The virtual functions can also be replaced by a static table of function pointers per `T`, which is what a hand-written vtable is.

A *fat pointer* moves the table pointer out of the object: a non-owning pair of a pointer to the object and a pointer to the table of functions for its type. Dispatch costs the same as through a vptr, but any type can be wrapped after the fact, and each reference is two pointers wide.

*Further reading:* [std::variant](https://en.cppreference.com/w/cpp/utility/variant), [std::function](https://en.cppreference.com/w/cpp/utility/functional/function)
