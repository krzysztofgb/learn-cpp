:::predict{#P1}
```cpp
struct Base : std::exception {
    const char* what() const noexcept override { return "base"; }
};
struct Der : Base {
    const char* what() const noexcept override { return "der"; }
};
try { throw Der{}; } catch (Base e) { cout << e.what(); }
```
::answer
`base`

Catching by value slices `Der` to `Base`.
:::

:::predict{#P2}
```cpp run=none
try {
    try { throw Der{}; }
    catch (Base& e) { throw e; }
} catch (Der&)  { cout << "der"; }
  catch (Base&) { cout << "base"; }
```

(What if `throw e;` becomes `throw;`?)
::choices
- [ ] `der`; with `throw;`: `der`
- [ ] `base`; with `throw;`: `base`
- [x] `base`; with `throw;`: `der`
- [ ] `der`; with `throw;`: `base`
::answer
`base`; with `throw;`: `der`

`throw e;` throws a copy of static type `Base`. `throw;` rethrows the original `Der`.
:::

:::predict{#P3}
```cpp
void f();
void g() noexcept;
cout << noexcept(f()) << noexcept(g()) << noexcept(1 + 1);
```
::answer
`011`

`f` isn't declared `noexcept`; built-in arithmetic can't throw.
:::

:::predict{#P4}
```cpp
struct S {
    S() = default;
    S(const S&) { cout << 'C'; }
    S(S&&)      { cout << 'M'; }
};
std::vector<S> v;
v.reserve(1);
v.emplace_back();
v.emplace_back();
```

(What if the move constructor is `noexcept`?)
::choices
- [ ] `M` both ways
- [x] `C`; with `noexcept`: `M`
- [ ] `C` both ways
- [ ] `CC`; with `noexcept`: `MM`
::answer
`C`; with `noexcept`: `M`

Reallocation copies the existing element unless the move is `noexcept`.
:::

:::predict{#P5}
```cpp
void f() noexcept { throw 1; }
try { f(); } catch (...) { cout << "caught"; }
cout << "after";
```
::choices
- [ ] `caughtafter`
- [ ] `after`
- [x] Nothing: the program terminates
- [ ] It doesn't compile
::answer
Terminates; nothing printed

The exception can't escape `f`, so `std::terminate` runs before any handler.
:::

:::predict{#P6}
```cpp
std::expected<int, std::string> parse(std::string_view s) {
    if (s.empty()) return std::unexpected("empty");
    return static_cast<int>(s.size());
}
auto r = parse("abc").transform([](int n) { return n * 10; });
auto e = parse("").transform([](int n) { return n * 10; });
cout << *r << ' ' << e.error();
```
::answer
`30 empty`

`transform` applies only to a value; the error passes through untouched.
:::
