### How virtual dispatch is implemented

The standard doesn't specify it, but every mainstream ABI (Itanium on Linux and macOS, MSVC on Windows) does the same thing:

- Each polymorphic class has one *vtable*: an array of function pointers, plus the RTTI pointer and an offset-to-top used for casts.
- Each object of a polymorphic class holds a hidden *vptr*, usually its first 8 bytes, pointing at its class's vtable.
- A virtual call loads the vptr, loads the function pointer at a fixed slot, and makes an indirect call.

The costs: one or two dependent loads (possible cache misses), an indirect branch the CPU must predict, and, most importantly, the call usually can't be inlined, which blocks the optimizations inlining enables. A well-predicted virtual call in a hot loop costs a few nanoseconds; an unpredictable one costs a branch mispredict (\~15–20 cycles) each time.

**Devirtualization:** the compiler can call directly when it knows the dynamic type: the class or function is `final`, the object is a local of known type, or LTO sees the whole hierarchy. Mark leaf classes `final`.

### Rules that bite

- **Slicing:** copying a derived object into a base object by value copies only the base part. The vptr is the base's, so virtual calls go to base versions.
- **Virtual destructor:** deleting a derived object through a base pointer without a virtual destructor is UB. Polymorphic bases need either a public virtual destructor or a protected non-virtual one.
- **Virtual calls in constructors and destructors** dispatch to the class currently being constructed or destroyed, because the vptr is set progressively, base first. Calling a pure virtual function this way is UB (usually an abort with "pure virtual method called").
- **`override`** makes the compiler check that you're actually overriding. A mismatched signature without it silently declares a new function that hides the base one.
- **Default arguments** come from the static type (:mod[compilation-model]).
- A pure virtual function can still have a definition, and a pure virtual destructor *must* have one.
- A private virtual function can be overridden; that's the non-virtual interface (NVI) pattern: public non-virtual functions call private virtual hooks.
- Virtual functions can't be templates.

### Multiple and virtual inheritance

With `struct Z : X, Y`, a `Z` contains an `X` subobject and a `Y` subobject, each with its own vptr. Converting `Z*` to `Y*` adjusts the pointer value by the offset of `Y` inside `Z`, and calls through `Y`'s vtable go through *thunks* that adjust `this` back.

In a diamond (`L : Top`, `R : Top`, `Bot : L, R`), `Bot` contains two `Top` subobjects, and unqualified access to `Top`'s members is ambiguous. `virtual` inheritance (`L : virtual Top`) shares one `Top`, at the cost of an extra indirection to find it, and the *most-derived* class constructs the virtual base, ignoring the intermediate classes' initializers.

### Casts and RTTI

- `static_cast` downcast: no check. If the object isn't actually of that type, it's UB.
- `dynamic_cast` downcast: checked using RTTI. Returns `nullptr` for pointers, throws `std::bad_cast` for references. It needs a polymorphic source type and costs a hierarchy walk (sometimes string comparisons across shared libraries). Frequent `dynamic_cast` suggests a missing virtual function or a `std::variant`.
- `typeid(expr)` gives the dynamic type for polymorphic lvalues.
- Many low-latency codebases build with `-fno-rtti`, which disables `dynamic_cast` and `typeid` on polymorphic types.

### Alternatives to virtual dispatch

| Technique | Dispatch | Open to new types? | Typical use |
| --- | --- | --- | --- |
| Virtual functions | Runtime, indirect call | Yes | Plugin-style hierarchies |
| Templates / CRTP (:mod[metaprogramming]) | Compile time, inlinable | Yes, at compile time | Hot paths with known types |
| `std::variant` + `visit` (:mod[utilities]) | Runtime, jump table or `switch` | No, closed set | Message types, events |
| Type erasure (`std::function`) | Runtime, indirect call | Yes | Callbacks with value semantics |

In a market data handler, the set of message types is closed and known at compile time, so `variant` or a `switch` on a type byte usually beats a virtual hierarchy.
