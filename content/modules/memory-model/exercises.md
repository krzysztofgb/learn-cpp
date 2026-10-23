:::exercise{#E1 level=warm-up title="Message passing stress test"}
Implement P1 as a stress test: two threads, a spin barrier to start each iteration together, 10M iterations, and count `r1 == 1 && r2 == 0` outcomes. Run with relaxed, then release/acquire. Report counts on your machine, and if you can, on both an ARM machine (Apple Silicon, AWS Graviton, …) and an x86 one.
::hint
Reset variables between iterations and start both threads from a shared atomic iteration counter so they overlap; without careful alignment you'll see zero reorderings simply because the threads never race.
:::

:::exercise{#E2 level=standard title="Store buffering"}
Do the same for P3. Show the forbidden-by-SC outcome appears with acquire/release on both architectures and disappears with `seq_cst`.
:::

:::exercise{#E3 level=standard title="Read the assembly"}
On Compiler Explorer, compile `load`, `store`, `exchange`, `fetch_add` and `compare_exchange_strong` with each memory order for x86-64 and ARMv8 (with and without `-march=armv8.1-a` for LSE). Fill in your own version of the table in :sec[memory-model/hardware-mapping].
::hint
On ARMv8.0 without LSE, RMWs become `ldaxr`/`stlxr` loops; with LSE they're single instructions like `ldaddal`.
:::

:::exercise{#E4 level=standard title="Prove it"}
For the SPSC handoff of a struct (producer writes fields, then release-stores an index; consumer acquire-loads the index, then reads fields), draw the happens-before graph and identify the synchronizes-with edge that makes the field reads race-free.
:::

:::exercise{#E5 level=interview-hard title="Peterson's lock"}
Implement Peterson's mutual exclusion for two threads with `seq_cst` atomics and verify it with a stress test. Weaken to acquire/release and show it fails. Explain the failure as an SB pattern.
::hint
Each thread stores its own flag and then loads the other's flag: the SB pattern. Without a total order both can read the other's flag as false and enter the critical section.
:::
