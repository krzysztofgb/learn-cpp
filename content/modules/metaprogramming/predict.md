:::predict{#P1}
```cpp
using namespace std;
cout << is_same_v<int, remove_cvref_t<const int&>>
     << is_same_v<decay_t<int[3]>, int*>
     << is_same_v<decay_t<const int>, int>
     << is_same_v<remove_const_t<const int*>, int*>;
```
::answer
`1110`

`const int*` is a pointer to const; its top level isn't const, so `remove_const` leaves it alone.
:::

:::predict{#P2}
```cpp
template <class T>
auto describe(const T& t) -> decltype(t.size(), void()) { cout << "container "; }
void describe(...) { cout << "other "; }
describe(std::vector<int>{}); describe(42);
```
::answer
` container other  `

For `int`, `t.size()` fails in the trailing return type, so SFINAE removes that overload.
:::

:::predict{#P3}
```cpp
template <class T> concept Num = std::integral<T> || std::floating_point<T>;
template <class T> concept Int = Num<T> && std::integral<T>;
void f(Num auto) { cout << "num "; }
void f(Int auto) { cout << "int "; }
f(1); f(1.0);
```
::answer
` int num  `

`Int` subsumes `Num` because it's defined as `Num<T> && ...`.
:::

:::predict{#P4}
```cpp
template <class T> auto len(const T& t) {
    if constexpr (requires { t.size(); }) return t.size();
    else return 1;
}
cout << len(std::string("abc")) << len(5);
```
::answer
`31`

Each instantiation has only one live `return`, so return-type deduction is consistent.
:::

:::predict{#P5}
```cpp
template <class D> struct Base {
    void run() { static_cast<D*>(this)->impl(); }
    void impl() { cout << "base "; }
};
struct A : Base<A> { void impl() { cout << "A "; } };
struct B : Base<B> {};
A{}.run(); B{}.run();
```
::answer
` A base  `

`B` doesn't define `impl`, so lookup finds `Base<B>::impl`.
:::

:::predict{#P6}
```cpp
consteval int sq(int x) { return x * x; }
int n = 3;
cout << sq(4);
// cout << sq(n);   // what happens if uncommented?
```
::answer
`16`; uncommented: compile error

`sq(n)` isn't a constant expression.
:::
