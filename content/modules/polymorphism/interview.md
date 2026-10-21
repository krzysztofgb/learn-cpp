:::question{#Q1}
How are virtual functions implemented? Draw the object and vtable layout.
::answer
Each object holds a vptr to its class's vtable of function pointers; a call loads the vptr, loads the slot, and calls indirectly. See 6.1.
:::

:::question{#Q2}
What does a virtual call cost, and why is the lack of inlining the biggest cost?
::answer
Two dependent loads and an indirect branch, a few ns when predicted. The bigger cost is that the callee can't be inlined, so constant propagation, vectorization and dead-code elimination across the call are lost.
:::

:::question{#Q3}
When can the compiler devirtualize a call?
::answer
When the dynamic type is provably known: `final` classes or functions, objects of known concrete type, or whole-program knowledge through LTO. Speculative devirtualization with a type check is also possible.
:::

:::question{#Q4}
Why do polymorphic base classes need a virtual destructor?
::answer
Otherwise `delete base_ptr` calls only the base destructor, which is UB; in practice derived members leak.
:::

:::question{#Q5}
What is object slicing?
::answer
Copying a derived object into a base object by value, which keeps only the base subobject and the base vptr.
:::

:::question{#Q6}
What happens when you call a virtual function from a constructor?
::answer
It calls the version from the class whose constructor is running. If that version is pure virtual, the behavior is undefined.
:::

:::question{#Q7}
What's the diamond problem? How does virtual inheritance solve it, and what does it cost?
::answer
A class inherits the same base twice through two paths, creating duplicate subobjects and ambiguous member access. Virtual inheritance shares one subobject, adding an indirection (a virtual base offset) and making the most-derived class responsible for constructing it.
:::

:::question{#Q8}
`dynamic_cast` vs `static_cast` for downcasting: cost and safety?
::answer
`static_cast` is free but UB if wrong. `dynamic_cast` is checked but walks RTTI at runtime and requires RTTI enabled.
:::

:::question{#Q9}
Can a member function template be virtual? Why not?
::answer
No. The vtable needs a fixed set of slots, and a template has an unbounded set of instantiations.
:::

:::question{#Q10}
Compare C++ virtual functions with Go interfaces.
::answer
Both are runtime dispatch through tables of function pointers. C++ is nominal (explicit inheritance) and puts the vptr in every object; Go is structural and puts the table pointer in the interface value. Go builds the table pairing (itab) per type-interface pair, lazily.
:::

:::question{#Q11}
When would you choose `std::variant`, CRTP or virtual functions?
::answer
Variant for a closed set of types where you want value semantics and no allocation; CRTP or templates when types are known at compile time and the call must inline; virtual functions for open hierarchies where flexibility matters more than nanoseconds.
:::
