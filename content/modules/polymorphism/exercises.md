:::exercise{#E1 level=warm-up title="See the layout"}
Compile a small hierarchy with `clang++ -Xclang -fdump-record-layouts` and `-Xclang -fdump-vtable-layouts` (with MSVC, `/d1reportSingleClassLayout<Name>`). Annotate where the vptr sits, what each vtable slot holds, and how multiple inheritance adds a second vptr.
:::

:::exercise{#E2 level=standard title="Dispatch benchmark"}
Sum `area()` over 1M shapes of 3 kinds using: virtual calls, `std::variant` + `std::visit`, a `switch` on a type tag, and separate arrays per type. Run each with the objects sorted by type and shuffled. Explain the results in terms of branch prediction and inlining.
::hint
With shuffled objects, the indirect branch is unpredictable for virtual calls, and the `variant` jump table is unpredictable too. Sorting by type makes both predictable. Separate arrays per type let the compiler inline and vectorize, and usually win by a wide margin.
:::

:::exercise{#E3 level=standard title="Hand-rolled vtable"}
Implement `Shape` polymorphism in C style: a struct holding a pointer to a static table of function pointers, plus the object data. Then implement a fat-pointer interface: a non-owning `{data*, table*}` pair that can wrap any type with `area()`, without that type inheriting from anything. Compare `sizeof` and call sequences.

> **Coming from Go?** The fat pointer is a Go interface value, built by hand.
::hint
C++ objects are one pointer larger (the vptr), but references to them are thin. With fat pointers the objects stay smaller, but every interface value is two pointers.
:::

:::exercise{#E4 level=standard title="Diamond construction"}
Build a virtual-inheritance diamond where each class prints and takes a constructor argument. Show that the most-derived class's initializer for the virtual base is the one used, and what happens if it doesn't provide one.
::hint
If the most-derived class doesn't name the virtual base, its default constructor is used even if `L` and `R` pass arguments.
:::

:::exercise{#E5 level=interview-hard title="Type erasure"}
Implement `AnyShape`, a value type that holds any object with `double area() const` without requiring inheritance, using an internal concept/model pair (Sean Parent style). Add a 32-byte small buffer so small shapes don't allocate. Count allocations to prove it.
:::
