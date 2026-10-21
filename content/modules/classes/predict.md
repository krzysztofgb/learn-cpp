:::predict{#P1}
```cpp
struct S {
    int a, b;
    S(int x) : b(x), a(b + 1) {}
};
S s(5);
cout << s.a;
```
::answer
UB (garbage)

`a` is declared first, so it's initialized first, from `b`, which isn't initialized yet.
:::

:::predict{#P2}
```cpp
struct W {
    W() { cout << "D "; }
    W(const W&) { cout << "C "; }
    W(W&&) { cout << "M "; }
    W& operator=(const W&) { cout << "CA "; return *this; }
};
W a;
W b = a;
W c(std::move(a));
b = c;
W d = W();
```
::answer
` D C M CA D  `

`W d = W();` uses guaranteed copy elision: one default construction, no move.
:::

:::predict{#P3}
```cpp
struct Qty { Qty(int v) : v(v) {} int v; };
void place(Qty q) { cout << q.v; }
place(42);
```

(What changes if the constructor is `explicit`?)
::answer
`42`

`Qty(int)` converts implicitly. With `explicit`, `place(42)` fails to compile; write `place(Qty{42})`.
:::

:::predict{#P4}
```cpp
struct E {};
struct A { E e; int x; };
struct B { [[no_unique_address]] E e; int x; };
struct C : E { int x; };
cout << sizeof(E) << sizeof(A) << sizeof(B) << sizeof(C);
```
::answer
`1844`

`A` pads the 1-byte `E` member to 4. `[[no_unique_address]]` and EBO let `E` take no space.
:::

:::predict{#P5}
```cpp
struct T {
    ~T() {}
    std::vector<int> v;
};
T a;
a.v = {1, 2, 3};
T b = std::move(a);
cout << a.v.size();
```
::answer
`3`

The user-declared destructor suppresses the implicit move constructor, so `std::move(a)` copies.
:::

:::predict{#P6}
```cpp
struct S {
    int x = 1;
    S() : x(2) {}
    S(int) {}
};
cout << S().x << S(0).x;
```
::answer
`21`

A constructor's initializer list overrides the default member initializer; `S(int)` falls back to it.
:::
