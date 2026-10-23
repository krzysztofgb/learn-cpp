## How to use it

1. Do Round 1 cold, recording your answers. Score yourself; anything wrong points back to a module to review: every answer ends with a *Review* line naming the section that teaches its rule, and the few rules no earlier module states are collected at the end of this guide.
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

## Rules the earlier modules don't spell out

Review these after the rounds; they're the rules some answers rely on that no earlier module states directly.

- **Argument conversion:** an argument converts implicitly to its parameter's type, narrowing included (only brace initialization rejects narrowing). An `int` passed where a `char` is expected becomes that character code, so of `std::string::operator+=`'s overloads (`const std::string&`, `const char*`, `char`, initializer list), an `int` argument selects `char`.
- **Boolean conversion** \[conv.bool\]: any pointer or arithmetic value converts to `bool` (null or zero is `false`). It is a standard conversion, so in overload resolution it beats every user-defined conversion, such as `std::string`'s converting constructor from `const char*`. A string literal is a `const char[N]`, and its decay to `const char*` costs nothing in the ranking.
- **Floating-point widening** \[conv.fpprom\]: `float` → `double` is exact, so the result is the `float`'s value, already rounded to 24 significant bits. The literal `0.1` is 0.1 rounded to 53 bits, a different number. In a mixed comparison the `float` is widened, so the two decimal-looking values compare by their rounded binary values.
- **`insert` on maps and sets:** `insert` and `emplace` return `std::pair<iterator, bool>`. If the key already exists, nothing is inserted or overwritten, the iterator points at the existing element and the `bool` is `false`. Use `insert_or_assign` or `operator[]` to overwrite.
- **Statics in templates:** each specialization of a function template (each distinct set of template arguments) is a separate function with its own function-local statics. The same goes for static data members of class templates: `Ring<int>` and `Ring<long>` don't share them.
- **Returning a parameter:** a parameter is created by the caller before the call, so it can never be constructed in the return slot: neither guaranteed elision nor NRVO applies to `return param;`. Implicit move does apply (the operand is first treated as an rvalue), but if the class has no move constructor, for example because a user-declared copy constructor suppressed it, the rvalue binds to `const T&` and the copy constructor runs.
- **Integer division** \[expr.mul\]: `/` truncates toward zero, and `(a / b) * b + a % b == a` always holds, so a nonzero `%` result takes the sign of the dividend: `-7 / 2 == -3` and `-7 % 2 == -1`.
- **Shifts before C++20** \[expr.shift\]: C++14 and C++17 defined `E1 << E2` for a signed non-negative `E1` only when the mathematical result fits in the corresponding unsigned type; the value is then converted to the signed type, which is implementation-defined when it doesn't fit there. C++11 required the result to fit in the signed type itself, otherwise UB. Left-shifting a negative value was UB until C++20.
- **The comma operator** \[expr.comma\]: the built-in `a, b` evaluates `a` completely, side effects included, discards its value, then evaluates `b`; the result is `b`. The commas between function arguments or declarators are not this operator and sequence nothing.
- **String comparison:** `std::string`'s relational operators compare lexicographically: the first differing character decides, and a proper prefix is less than the longer string. Digits compare as characters, never as numbers.
- **Literal types** \[lex.icon\]: an unsuffixed decimal integer literal has the first of `int`, `long` and `long long` that can hold its value; hexadecimal and octal literals also try the unsigned type at each rank. Suffixes (`u`, `l`, `ul`, `ll`, `ull`, and `z`/`uz` in C++23) narrow the list. A literal is never negative: `-2147483648` is unary minus applied to `2147483648`, which already doesn't fit in `int`.
- **The conditional operator** \[expr.cond\]: `c ? a : b` has a single type fixed at compile time, whichever branch runs. Its value category is covered in :mod[value-categories-and-moves]; its type: when both operands are arithmetic, the usual arithmetic conversions give them a common type, so `int` and `double` make it a `double`. `sizeof` doesn't evaluate its operand, only its type.
- **`delete this`:** allowed when the object came from a plain `new` and nothing touches it afterwards. Once it's deleted, reading a data member or calling a non-static member function is a use after free (\[basic.life\]).
- **Null pointers and deallocation** \[expr.delete\]: `delete` and `delete[]` on a null pointer do nothing, and so does `std::free(nullptr)`, so there's no need to test first. Deleting or freeing the same non-null pointer twice is UB.

*Further reading:* [Implicit type conversion](https://www.learncpp.com/cpp-tutorial/implicit-type-conversion/), [Function overload resolution and ambiguous matches](https://www.learncpp.com/cpp-tutorial/function-overload-resolution-and-ambiguous-matches/), [Function template instantiation](https://www.learncpp.com/cpp-tutorial/function-template-instantiation/), [Arithmetic operators](https://www.learncpp.com/cpp-tutorial/arithmetic-operators/), [The comma operator](https://www.learncpp.com/cpp-tutorial/the-comma-operator/), [Literals](https://www.learncpp.com/cpp-tutorial/literals/), [The conditional operator](https://www.learncpp.com/cpp-tutorial/the-conditional-operator/)
