:::question{#Q1}
What is placement new? How do you destroy an object created with it?
::answer
It constructs an object in pre-allocated memory: `new (buf) T(args)`. Destroy it by calling the destructor explicitly, then free the memory however it was obtained.
:::

:::question{#Q2}
What's the difference between `operator new` and a `new` expression?
::answer
`operator new` only allocates raw bytes (like `malloc` but throws). The `new` expression calls it and then runs the constructor.
:::

:::question{#Q3}
What is the strict aliasing rule, and why does it exist?
::answer
An object may be accessed only through its own type or a byte type. It lets compilers assume pointers of different types don't alias, enabling reordering, register caching and vectorization.
:::

:::question{#Q4}
How do you correctly reinterpret the bits of a `float` as an integer?
::answer
`std::bit_cast<std::uint32_t>(f)`, or `memcpy` into a `std::uint32_t`.
:::

:::question{#Q5}
What is alignment? What happens with misaligned access?
::answer
Objects of a type must start at addresses that are multiples of its alignment. Misaligned access is UB; in practice it can be slower, fault on some instructions, or break atomicity.
:::

:::question{#Q6}
How does struct padding work, and how do you minimize it?
::answer
The compiler adds padding before members to align them and at the end to align the size. Sort members by decreasing alignment, and use smaller types where possible.
:::

:::question{#Q7}
What does "trivially copyable" mean, and why does it matter?
::answer
Copying it with `memcpy` produces an equivalent object: no non-trivial copy or move operations, and a trivial destructor. It enables `memcpy`, `bit_cast` and many container optimizations.
:::

:::question{#Q8}
How would you parse a binary market data message without UB and without extra copies?
::answer
Read each field with `memcpy` into a local of the right type (compiles to plain loads), byte-swap as needed, and work with prices as integers. In C++23, `start_lifetime_as` on aligned buffers is an option where supported.
:::

:::question{#Q9}
What does `std::launder` do?
::answer
It returns a pointer to an object created in storage previously occupied by another object, when using the old pointer would be invalid. Rarely needed outside low-level containers.
:::

:::question{#Q10}
`new` vs `malloc`?
::answer
`new` constructs objects, throws on failure and is type-safe; `malloc` returns raw bytes, returns null on failure, and doesn't construct non-trivial types.
:::
