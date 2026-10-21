:::predict{#P1}
~~~cpp note="In the browser this is wasm32, where `long` and pointers are 32-bit, so sizes are halved here: 4 8 8 4."
auto close_file = [](FILE* f) { std::fclose(f); };
cout << sizeof(std::unique_ptr<int>) << ' '
     << sizeof(std::shared_ptr<int>) << ' '
     << sizeof(std::unique_ptr<FILE, int (*)(FILE*)>) << ' '
     << sizeof(std::unique_ptr<FILE, decltype(close_file)>);
~~~
::answer
`8 16 16 8`

Object pointer + control block pointer; a function-pointer deleter must be stored; a captureless lambda is empty.
:::

:::predict{#P2}
```cpp
auto a = std::make_shared<int>(1);
auto b = a;
std::weak_ptr<int> w = a;
cout << a.use_count();
b.reset();
cout << a.use_count() << w.expired();
a.reset();
cout << w.expired();
```
::answer
`2101`

Weak pointers don't count toward `use_count`.
:::

:::predict{#P3}
```cpp
struct Node {
    std::shared_ptr<Node> next;
    ~Node() { cout << '~'; }
};
{
    auto a = std::make_shared<Node>();
    auto b = std::make_shared<Node>();
    a->next = b;
    b->next = a;
}
cout << "end";
```
::answer
`end`

The cycle keeps both counts at 1; nothing is destroyed, both leak. Make one link a `weak_ptr`.
:::

:::predict{#P4}
```cpp
struct B { ~B() { cout << "~B"; } };
struct D : B { ~D() { cout << "~D"; } };
{ std::shared_ptr<B> p = std::make_shared<D>(); }
cout << '|';
{ std::unique_ptr<B> q = std::make_unique<D>(); }
```
::answer
`~D~B|` then UB

`shared_ptr` captured a deleter for `D`. `unique_ptr<B>` calls `delete` on a `B*` without a virtual destructor: UB (typically prints `~B`).
:::

:::predict{#P5}
```cpp
struct P { int x = 5; };
auto sp = std::make_shared<P>();
std::shared_ptr<int> xp(sp, &sp->x);
sp.reset();
cout << *xp << xp.use_count();
```
::answer
`51`

The aliasing pointer keeps the whole `P` alive and is now the only owner.
:::
