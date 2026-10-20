# Module 27: UB and trick-question gauntlet

This module is pure drilling, mixing material from every earlier module the way interviewers do. Treat each round as timed: about 30 seconds per snippet, answer out loud, then check. Every "predict the output" answer in Round 1 was compiled and run with GCC 13 and Clang 18 (C++20, x86-64 Linux); both agreed.

## How to use it

1. Do Round 1 cold, recording your answers. Score yourself; anything wrong points back to a module to review.
2. Do Round 2 explaining aloud: what the bug is, which rule, what the optimizer may do, how to fix it.
3. Do Round 3 as rapid fire: true or false, one-sentence reason.
4. Repeat the whole module a week later. The goal is instant, confident answers.

## Round 1: Predict the output

Assume `#include`s, `using std::cout;`, C++20, 64-bit Linux or macOS.

**Q1**

```cpp kind=fragment run=local
unsigned char a = 200, b = 100;
cout << (a + b > 255);
```

**Q2**

```cpp kind=fragment run=local
cout << (sizeof(int) > -1);
```

**Q3**

```cpp kind=fragment run=local
struct B { virtual ~B() { f(); } virtual void f() { cout << "B"; } };
struct D : B { void f() override { cout << "D"; } };
{ D d; }
```

**Q4**

```cpp kind=fragment run=local
std::string s = "abc";
s += 'd' + 1;
cout << s;
```

**Q5**

```cpp kind=fragment run=local
void g(std::string) { cout << "str"; }
void g(bool)        { cout << "bool"; }
g("hi");
```

**Q6**

```cpp kind=fragment run=local
std::vector<int> v{1, 2, 3};
for (auto x : v) x *= 2;
cout << v[0];
```

**Q7**

```cpp kind=fragment run=local note="In the browser this is wasm32, where `long` and pointers are 32-bit, so this prints 4 here."
int a[] = {1, 2, 3};
auto b = a;
cout << sizeof(b);
```

**Q8**

```cpp kind=fragment run=local
cout << (0.1f == 0.1);
```

**Q9**

```cpp kind=fragment run=local
std::map<int, int> m{{1, 1}};
auto [it, ok] = m.insert({1, 5});
cout << ok << it->second;
```

**Q10**

```cpp kind=fragment run=local
template <class T> int counter() { static int n = 0; return ++n; }
counter<int>(); counter<int>();
cout << counter<int>() << counter<double>();
```

**Q11**

```cpp kind=fragment run=local
struct A {
    A() { cout << "A"; }
    A(const A&) { cout << "c"; }
};
A pass(A a) { return a; }
pass(A());
```

**Q12**

```cpp kind=fragment run=local
int x = 0;
auto f = [=]() mutable { return ++x; };
f(); f();
cout << x << f();
```

**Q13**

```cpp kind=fragment run=local
cout << -5 / 2 << ' ' << -5 % 2 << ' ' << (-5 >> 1);
```

**Q14**

```cpp kind=fragment run=local
int a = 1;
int b = (a++, a++, a);
cout << b;
```

**Q15**

```cpp kind=fragment run=local
cout << std::boolalpha << (std::string("10") < std::string("9"));
```

**Q16**

```cpp kind=fragment run=local
std::array<int, 3> a{};
cout << a.size() << sizeof(a);
```

**Q17**

```cpp kind=fragment run=local
auto big = 2147483648;
cout << sizeof(big);
```

**Q18**

```cpp kind=fragment run=local
cout << (true ? 1 : 2.0) << ' ' << sizeof(true ? 1 : 2.0);
```

**Q19**

```cpp kind=fragment run=local
unsigned u = 0;
cout << u - 1;
```

**Q20** (C++20, and what about C++17?)

```cpp kind=fragment run=local
cout << (1 << 31);
```

**Q21**

```cpp kind=fragment run=local
std::vector<bool> vb(3);
auto& r = vb[0];
```

**Q22**

```cpp kind=fragment run=local
auto m = std::max('a', 98);
```

## Round 2: Spot the UB

For each: is there UB? If so, which rule, and what's the fix? Some are fine.

**U1**

```cpp kind=fragment run=local
int i = 5;
int r = i++ * ++i;
```

**U2**

```cpp kind=fragment run=local
const int& m = std::min(1, 2);
cout << m;
```

**U3**

```cpp kind=fragment run=local
std::vector<int> v;
v.reserve(2);
int* p = &v.emplace_back(1);
v.push_back(2);
v.push_back(3);
cout << *p;
```

**U4**

```cpp kind=fragment run=local
struct Px { int ticks; };
Px p;
cout << p.ticks;
```

**U5**

```cpp kind=fragment run=local
std::string_view sv = std::string("BTC") + "-USD";
cout << sv;
```

**U6**

```cpp kind=fragment run=none
for (int x : v) if (x < 0) v.push_back(-x);
```

**U7**

```cpp kind=fragment run=none
void Session::close() { delete this; log("closed", id_); }
```

**U8**

```cpp kind=fragment run=local
char buf[16] = "abcdef";
std::memcpy(buf + 1, buf, 6);
```

**U9**

```cpp kind=fragment run=godbolt note="Uses threads, which the in-browser compiler does not support yet. Run it in Compiler Explorer."
int ticks = 0;
std::thread a([&] { ++ticks; }), b([&] { ++ticks; });
a.join(); b.join();
```

**U10**

```cpp kind=fragment run=local
std::variant<int, double> v = 1.5;
int i = std::get<int>(v);
```

**U11**

```cpp kind=fragment run=local
int* p = nullptr;
delete p;
std::free(nullptr);
```

**U12**

```cpp kind=fragment run=local
int x = INT_MAX;
long long y = x + 1;
```

**U13**

```cpp kind=fragment run=local
std::vector<int> v{3, 1, 2};
std::sort(v.begin(), v.end(), [](int a, int b) { return a > b || a == b; });
```

**U14**

```cpp kind=fragment run=local
unsigned int u = UINT_MAX;
u += 1;
```

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

## Answer key

### Round 1

| # | Output | Why | Module |
| --- | --- | --- | --- |
| Q1 | `1` | Both operands promote to `int`; 300 > 255. | 1 |
| Q2 | `0` | `-1` converts to `size_t`, becoming the largest value. | 1 |
| Q3 | `B` | During `~B`, the object is a `B`; `D` is already destroyed. | 6 |
| Q4 | `abce` | `'d' + 1` is the `int` 101, converted to `char` `'e'` by `operator+=(char)`. | 1 |
| Q5 | `bool` | Pointer-to-bool is a standard conversion, which beats the user-defined conversion to `std::string`. | 3 |
| Q6 | `1` | `auto x` copies each element. | 13 |
| Q7 | `8` | `auto` decays the array to `int*`. | 2 |
| Q8 | `0` | `0.1f` widened to `double` isn't the double closest to 0.1. | 1 |
| Q9 | `01` | Insert fails when the key exists and returns the existing element. | 11 |
| Q10 | `31` | Each instantiation has its own static. | 14 |
| Q11 | `Ac` | The prvalue argument initializes the parameter directly. The return can't elide a parameter, and the user-declared copy constructor suppresses the implicit move, so it copies. | 4, 8 |
| Q12 | `03` | The lambda modifies its own copy. | 13 |
| Q13 | `-2 -1 -3` | Division truncates toward zero; `%` follows; `>>` on negatives is arithmetic (defined since C++20). | 1 |
| Q14 | `3` | The built-in comma operator sequences left to right. | 1 |
| Q15 | `true` | Strings compare lexicographically: `'1' < '9'`. | 11 |
| Q16 | `312` | Three elements, 12 bytes, no overhead. | 11 |
| Q17 | `8` | The literal doesn't fit in `int`, so its type is `long` (LP64). | 1 |
| Q18 | `1 8` | The conditional's type is `double`; `1.0` prints as `1`. | 1 |
| Q19 | `4294967295` | Unsigned arithmetic wraps. | 1 |
| Q20 | `-2147483648`; implementation-defined in C++14/17; UB in C++11 | C++20 \[expr.shift\]: the result is the value congruent to 1 × 2³¹ modulo 2³². C++14/17: 2³¹ fits in `unsigned int`, so it's converted to `int`, an implementation-defined conversion. C++11 required the result to fit in `int` itself, so it was UB. | 1 |
| Q21 | Doesn't compile | `vb[0]` returns a proxy prvalue, which can't bind to a non-`const` lvalue reference. | 11 |
| Q22 | Doesn't compile | `T` can't be both `char` and `int`. | 14 |

### Round 2

- **U1:** UB: two unsequenced modifications of `i`.
- **U2:** UB: `std::min` returns a reference to one of the temporaries, which die at the end of the statement.
- **U3:** UB: the third insertion exceeds capacity 2 and reallocates, so `p` dangles.
- **U4:** UB (erroneous behavior in C++26): `p` has automatic storage and `ticks` is never initialized. Write `Px p{};`.
- **U5:** UB on use: the concatenated temporary string dies at the semicolon.
- **U6:** UB: `push_back` may reallocate while the range-`for` holds iterators. Collect additions separately, or index with a saved size.
- **U7:** UB: `id_` is read after the object is deleted. Copy what you need first, and make sure nothing touches the object after `delete this`.
- **U8:** UB: `memcpy` with overlapping ranges. Use `memmove`.
- **U9:** UB: data race on `ticks`. Use `std::atomic<int>`.
- **U10:** Not UB: `std::get` throws `std::bad_variant_access`.
- **U11:** Not UB: deleting a null pointer and freeing null are both no-ops.
- **U12:** UB: `x + 1` is computed in `int` and overflows before the conversion to `long long`. Write `x + 1LL`.
- **U13:** UB: the comparator returns true for equal elements, so it isn't a strict weak ordering.
- **U14:** Not UB: unsigned arithmetic wraps to 0.

### Round 3

1. False: it's a cast; moving happens in the constructor or assignment it enables.
2. True.
3. False: no atomicity, no ordering; still a data race.
4. False: only when it reallocates (otherwise only the end iterator).
5. True, since C++11.
6. False: two's complement representation is mandated, but overflow is still UB.
7. False: only the reference count is thread-safe.
8. False: average O(1); worst case O(n).
9. False: it's at least 1.
10. False: it gets no implicit move; moves become copies.
11. False: RMWs are atomic regardless of memory order.
12. False: it's TSO; a load can pass an earlier store to a different address.
13. False: it becomes erroneous behavior (defined, but wrong and diagnosable).
14. False: use `std::stable_sort`.
15. False: it calls the version for the class under construction.
16. False: `std::move` on a `const` object selects the copy constructor.
17. False.
18. True.
19. False: it's an ODR violation with no diagnostic required; the linker silently keeps one.
20. False: the discarded future's destructor blocks until `f` finishes.
