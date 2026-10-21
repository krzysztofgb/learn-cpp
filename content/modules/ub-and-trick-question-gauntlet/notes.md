## How to use it

1. Do Round 1 cold, recording your answers. Score yourself; anything wrong points back to a module to review.
2. Do Round 2 explaining aloud: what the bug is, which rule, what the optimizer may do, how to fix it.
3. Do Round 3 as rapid fire: true or false, one-sentence reason.
4. Repeat the whole module a week later. The goal is instant, confident answers.

## Round 3: Rapid fire (true or false)

1. `std::move` moves the object.
2. A defaulted move constructor is `noexcept` if all members' move constructors are.
3. `volatile` makes a variable safe to share between threads.
4. `std::vector::push_back` invalidates all iterators every time.
5. A function-local `static` is initialized thread-safely.
6. Signed integer overflow wraps in C++20 because integers are two's complement.
7. `std::shared_ptr` makes the pointed-to object thread-safe.
8. `std::unordered_map` lookups are guaranteed O(1).
9. `sizeof` of an empty class is 0.
10. A class with a user-declared destructor gets an implicit move constructor.
11. Relaxed atomic increments from many threads can lose updates.
12. `x86` is sequentially consistent.
13. Reading an uninitialized `int` is UB in C++26.
14. `std::sort` is stable.
15. Calling a virtual function in a constructor calls the most-derived override.
16. `const` objects can be moved from.
17. `string_view` is null-terminated.
18. `delete` on a base pointer to a derived object without a virtual destructor is UB.
19. Two inline functions with the same name but different bodies in two TUs is a link error.
20. `std::async(std::launch::async, f);` with the result discarded runs `f` in the background without blocking.
