:::question{#Q1}
What's the difference between a declaration and a definition?
::answer
A declaration introduces a name and type; a definition also creates the entity (allocates storage or provides the body). Every definition is a declaration.
:::

:::question{#Q2}
What is the One Definition Rule? What happens if you violate it?
::answer
One definition per program for non-inline functions and variables; identical definitions per TU for classes, templates and inline entities. Violations are ill-formed with no diagnostic required, so the program silently misbehaves.
:::

:::question{#Q3}
What does `inline` actually mean in modern C++?
::answer
Multiple identical definitions are allowed across TUs. Whether a call is actually inlined is the optimizer's decision and unrelated.
:::

:::question{#Q4}
List the meanings of `static`.
::answer
Internal linkage at namespace scope; static storage for a local (initialized once, thread-safely); class member shared by all instances.
:::

:::question{#Q5}
Anonymous namespace vs `static` at namespace scope: is there a difference?
::answer
Both give internal linkage. The anonymous namespace also works for types and is the modern style.
:::

:::question{#Q6}
What is ADL, and why does it exist?
::answer
It extends unqualified function lookup to the namespaces of the argument types, so operators and customization functions defined next to a type are found without qualification.
:::

:::question{#Q7}
Why do templates usually live in headers? How can you avoid it?
::answer
Instantiation needs the full definition in the using TU. Explicit instantiation for a known set of types, with `extern template` declarations, avoids it.
:::

:::question{#Q8}
What is name mangling, and what does `extern "C"` do?
::answer
Encoding namespaces and parameter types into symbol names to support overloading. `extern "C"` uses plain C names for interop.
:::

:::question{#Q9}
Why does generic code write `using std::swap; swap(a, b);`?
::answer
ADL finds a type-specific `swap` if one exists in the type's namespace, and `std::swap` is the fallback. Calling `std::swap` directly skips the custom one.
:::

:::question{#Q10}
A derived class declares `f(double)` and you call `d.f(1)` where the base has `f(int)`. Which runs, and how do you change that?
::answer
`D::f(double)` runs because name lookup stops at `D`. Add `using B::f;` in `D` to bring `B::f(int)` into overload resolution.
:::

:::question{#Q11}
Why are default arguments on virtual functions a trap?
::answer
The default comes from the static type while the body comes from the dynamic type, so a call through a base pointer mixes the base's default with the derived body.
:::
