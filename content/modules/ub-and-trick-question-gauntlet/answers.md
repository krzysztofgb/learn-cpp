## Round 3

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
