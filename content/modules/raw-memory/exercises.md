:::exercise{#E1 level=warm-up title="Layout audit"}
For four structs from a market data message definition, print `offsetof` and `sizeof` for every member, compile with `-Wpadded`, then reorder members to minimize size. Report bytes saved.
:::

:::exercise{#E2 level=standard title="Big-endian reads"}
Implement `template <std::integral T> T read_be(const std::byte* p)` for unaligned buffers using `memcpy` and `std::byteswap`. Confirm on Compiler Explorer that it compiles to one load plus one `rev`/`bswap` on ARM64 and x86-64.
::hint
Copy into a `T`, then `if constexpr (std::endian::native == std::endian::little) v = std::byteswap(v);`.
:::

:::exercise{#E3 level=standard title="Object pool"}
Implement `ObjectPool<T, N>`: aligned raw storage, a free list threaded through unused slots, `acquire(args...)` with placement new, and `release(T*)` calling the destructor. Verify under ASan that a double release or use-after-release is caught (hint: poison released slots with the ASan interface, or track state in debug builds).
::hint
Store the free-list `next` pointer inside the unused slot's storage, so the pool needs no extra memory.
:::

:::exercise{#E4 level=interview-hard title="`Optional<T>`"}
Implement it with a union or aligned buffer and a `bool`, using `construct_at` and `destroy_at`. Make copy and move correct, and make `Optional<int>` trivially copyable and trivially destructible using C++20 conditionally trivial special members (`~Optional() requires std::is_trivially_destructible_v<T> = default;`).
:::

:::exercise{#E5 level=standard title="Three decoders"}
Decode a packed 20-byte binary message into a struct three ways: `memcpy` per field, `std::bit_cast` from `std::array<std::byte, N>`, and `reinterpret_cast`. Compare the generated assembly and state which are legal.
::hint
`memcpy` and `bit_cast` are legal and compile to the same loads. `reinterpret_cast` is UB unless the buffer actually contains such an object, and may also be misaligned.
:::
