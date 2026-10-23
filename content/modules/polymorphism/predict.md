:::predict{#P1}
```cpp
struct A { virtual const char* name() const { return "A"; } };
struct B : A { const char* name() const override { return "B"; } };
void by_val(A a)        { cout << a.name(); }
void by_ref(const A& a) { cout << a.name(); }
B b; by_val(b); by_ref(b);
```
::answer
`AB`

`by_val` slices to an `A`; `by_ref` dispatches on the real `B`.
:::

:::predict{#P2}
```cpp
struct Base {
    Base() { hello(); }
    virtual void hello() { cout << "Base "; }
};
struct Der : Base { void hello() override { cout << "Der "; } };
Der d; d.hello();
```
::answer
` Base Der  `

During `Base`'s constructor the object is a `Base`.
:::

:::predict{#P3}
~~~cpp note="In the browser this is wasm32, where `long` and pointers are 32-bit: the vptr is 4 bytes, so this prints 1 4 8."
struct E {};
struct V { virtual ~V() = default; };
struct VI : V { int x; };
cout << sizeof(E) << ' ' << sizeof(V) << ' ' << sizeof(VI);
~~~
::answer
`1 8 16`

The vptr takes 8 bytes; `int x` plus padding rounds to 16.
:::

:::predict{#P4}
```cpp
struct X { int x; virtual ~X() = default; };
struct Y { int y; virtual ~Y() = default; };
struct Z : X, Y {};
Z z;
X* px = &z; Y* py = &z;
cout << (static_cast<void*>(px) == static_cast<void*>(&z))
     << (static_cast<void*>(py) == static_cast<void*>(&z))
     << (py == &z);
```
::answer
`101`

`X` is at offset 0, `Y` at offset 16. `py == &z` converts `&z` to `Y*` first, so it's true.
:::

:::predict{#P5}
```cpp
struct Top { Top() { cout << 'T'; } };
struct L : Top {};
struct R : Top {};
struct Bot : L, R {};
Bot b;
```

(And with `struct L : virtual Top` and `struct R : virtual Top`?)
::choices
- [ ] `TT` both ways
- [ ] `T`; with virtual: `TT`
- [x] `TT`; with virtual: `T`
- [ ] Doesn't compile (ambiguous `Top`); with virtual: `T`
::answer
`TT`; with virtual: `T`

Without `virtual` there are two `Top` subobjects.
:::

:::predict{#P6}
```cpp
struct A { virtual void f(int)    { cout << "A::f(int) "; } };
struct B : A { virtual void f(double) { cout << "B::f(double) "; } };
B b; A& a = b;
a.f(1); b.f(1);
```
::answer
` A::f(int) B::f(double)  `

`B::f(double)` doesn't override `A::f(int)`; it hides it. Through `A&` only `A::f(int)` is a candidate.
:::
