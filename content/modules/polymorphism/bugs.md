:::bug{#U1 findings=ub}
```cpp
struct Order { ~Order() {} };
struct LimitOrder : Order { std::string tag; };
Order* o = new LimitOrder;
delete o;
```
::answer
UB: deleting a `LimitOrder` through `Order*` without a virtual destructor. In practice `tag` leaks. Add `virtual ~Order() = default;`.
:::

:::bug{#U2 findings=ub}
```cpp
struct Msg { virtual ~Msg() = default; };
struct Trade : Msg { int px; };
struct Quote : Msg { int bid, ask; };
Msg* m = new Quote;
int p = static_cast<Trade*>(m)->px;
```
::answer
UB: a `static_cast` downcast to the wrong dynamic type. Use `dynamic_cast` and check, or a type tag.
:::

:::bug{#U3 findings=ub}
```cpp
struct Handler {
    Handler() { init(); }
    void init() { setup(); }
    virtual void setup() = 0;
};
```
::answer
UB: `init()` indirectly calls the pure virtual `setup()` during construction. Typically aborts with "pure virtual method called". Use a factory that calls `setup()` after construction.
:::

:::bug{#U4 findings=ub}
```cpp
struct Widget {
    virtual void draw();
    int x, y;
    Widget() { std::memset(this, 0, sizeof(*this)); }
};
```
::answer
UB: the class isn't trivially copyable, and `memset` overwrites the vptr. Use default member initializers.
:::

:::bug{#U5 findings=ub}
```cpp run=none
struct Base { virtual void f(); virtual ~Base() = default; int a; };
struct Derived : Base { int b; };
Base* arr = new Derived[10];
arr[1].f();
delete[] arr;
```
::answer
UB twice. `arr[1]` uses `sizeof(Base)` for pointer arithmetic, landing inside the first `Derived`. `delete[]` through a base pointer is UB even with a virtual destructor. Never treat arrays polymorphically; use `std::vector<std::unique_ptr<Base>>`.
:::
