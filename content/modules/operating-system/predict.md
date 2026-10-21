:::predict{#P1}
On Linux with 4 KB pages, `char* p = static_cast<char*>(malloc(1 << 30));` then writing one byte every 4096 bytes. How many page faults occur, and what is the resident memory before the loop? What changes on an Apple Silicon Mac?
::answer
About 262,144 minor faults; resident memory near zero before the loop

One fault per 4 KB page on first touch. With 16 KB pages on Apple Silicon, about 65,536.
:::

:::predict{#P2}
```cpp run=none
int x = 1;
if (fork() == 0) { x = 2; _exit(0); }
wait(nullptr);
printf("%d", x);
```
::answer
`1`

The child writes its own copy-on-write page.
:::

:::predict{#P3}
Output redirected to a file:

```cpp run=none
printf("a");
fork();
printf("b\n");
```
::answer
`ab` printed twice

When redirected, stdout is fully buffered; the unflushed "a" is duplicated by `fork`. On a terminal (line-buffered) it's also duplicated, since "a" has no newline.
:::

:::predict{#P4}
Does `clock_gettime(CLOCK_MONOTONIC, &ts)` enter the kernel on x86-64 Linux?
::answer
Usually not

The vDSO reads the clock in user space.
:::

:::predict{#P5}
A parent creates a `MAP_SHARED | MAP_ANONYMOUS` mapping, forks, and the child writes 42 into it. What does the parent read? And with `MAP_PRIVATE`?
::answer
42; with `MAP_PRIVATE`: the original value

Shared mappings share physical pages; private ones are copy-on-write.
:::
