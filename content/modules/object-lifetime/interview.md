:::question{#Q1}
What are the storage durations in C++?
::answer
Automatic, static, thread and dynamic; see table 5.1.
:::

:::question{#Q2}
What is RAII? Compare it to Go's `defer` or Java's `finally`.
::answer
Resource ownership tied to object lifetime: acquire in the constructor, release in the destructor, which runs on every exit including exceptions. Unlike `defer`, the cleanup travels with the object when it's moved or stored, and it's scoped to blocks rather than functions.
:::

:::question{#Q3}
What is temporary lifetime extension, and when doesn't it apply?
::answer
Binding a prvalue directly to a local `const T&` or `T&&` keeps it alive for the reference's scope. It doesn't apply through function return values, member functions returning references, views, return statements, or reference parameters.
:::

:::question{#Q4}
What is the static initialization order fiasco, and how do you avoid it?
::answer
Unspecified initialization order of globals across TUs means one global's initializer may use another before it's constructed. Use function-local statics, `constexpr`/`constinit`, or avoid dynamic initialization of globals.
:::

:::question{#Q5}
Are function-local statics thread-safe to initialize?
::answer
Yes, since C++11. The compiler emits a guard variable and a lock so exactly one thread initializes and others wait. There is a small check cost on every call.
:::

:::question{#Q6}
What happens when a constructor throws halfway through?
::answer
The destructor for that object does not run. Already-constructed bases and members are destroyed in reverse order, then the exception propagates; memory from a `new` expression is freed.
:::

:::question{#Q7}
Why shouldn't destructors throw?
::answer
They are implicitly `noexcept`, so a throw calls `std::terminate`. Even if marked `noexcept(false)`, throwing during unwinding terminates.
:::

:::question{#Q8}
In what order are members and bases destroyed?
::answer
Destructor body first, then members in reverse declaration order, then bases in reverse order of declaration.
:::

:::question{#Q9}
Give three ways to create a dangling reference.
::answer
Returning a reference to a local; capturing by reference in a lambda that outlives the scope; keeping a reference into a vector across `push_back`; `string_view` of a temporary string.
:::
