# Course content

Everything the app teaches lives here as plain Markdown and YAML. It is compiled at build time (`scripts/content/compile.ts`), so a mistake fails the build with its file and line instead of showing up as missing content. In `npm run dev`, saving a file reloads the page.

```
content/
  course.yaml                 phases and the order of modules
  overview.md                 the home page's "How the course works"
  modules/<slug>/
    module.yaml               title, topics, intro
    notes.md                  the reading tab
    predict.md                "Predict the output" items
    bugs.md                   "Spot the bug" items
    exercises.md              exercises
    interview.md              interview questions
    answers.md                reference material revealed on request (optional)
```

Every file in a module folder except `module.yaml` is optional: a tab appears only when it has content.

## Order and numbers

Nothing stores a number. A module's number comes from its position in `course.yaml`; notes sections are numbered `<module>.<n>` in order; items are labelled P1, U1, E1, Q1 by position. Moving a line or a block renumbers everything, including cross-references.

```yaml
title: C++ for Low-Latency Systems
phases:
  - title: Core language
    modules:
      - types-and-initialization
      - pointers-references-arrays
```

## module.yaml

```yaml
title: Lock-free programming
topics: CAS, ABA, hazard pointers, SPSC/MPMC queues    # one line, Markdown
intro: |                                               # shown above the tabs, Markdown
  "Implement an SPSC queue" is one of the most common questions…
readingLabel: Guide        # optional: name of the reading tab (default Notes)
numberSections: false      # optional: don't number notes.md's ### sections
```

## notes.md

Plain Markdown. Each `###` heading is a numbered section ("19.4 SPSC ring buffer"); write the heading without its number.

## Items

`predict.md`, `bugs.md`, `exercises.md` and `interview.md` hold blocks. Text before the first block is the tab's introduction. Each block has an id and keeps its answer inside it, after a marker line:

````md
:::predict{#cas-fails}
```cpp
std::atomic<int> a{5};
int expected = 3;
cout << a.compare_exchange_strong(expected, 10) << ' ' << expected;
```
::answer
`0 5`

The first paragraph of the answer is the output; the rest explains it (see Grading below).
:::

:::bug{#relaxed-tail}
Optional text before the code.
```cpp run=none
tail_.store(t + 1, std::memory_order_relaxed);
```
::answer
The relaxed store doesn't publish the slot write: data race. Use release.
:::

:::exercise{#spsc-queue level=standard title="SPSC queue"}
What to build. Any Markdown, including code.
::hint
An optional nudge.
:::

:::question{#why-acquire}
Why does the consumer need an acquire load?
::answer
The model answer.
:::
````

- **Ids** are what saved progress is keyed by. Pick a short name when adding an item and never change it: a new id means learners lose their answer to that item. Ids must be unique within a file. (Items migrated from the old format kept their old ids, such as `P3` or `B1`; their labels are still derived from position.)
- **Exercise levels:** `warm-up`, `standard` or `interview-hard`. Quote a title with `'…'` if it contains `"`.
- In predict and bug blocks, the first code block is the snippet: it is locked until the learner commits an answer.

## Grading

Every Predict and Spot-the-bug item is graded (correct, partly right, not quite), so each must say what a right answer is. Learners never type free text except an exact program output. The build rejects an item it can't grade.

- **Prints an exact output:** nothing to add. If the answer's first paragraph is a single code span (`` `0 5 5` ``), the item is graded on "It prints…" plus that output (whitespace runs don't matter); the right outcome with a different output is partly right.
- **A single non-printing outcome:** `:::predict{#P4 expect=compile-error}` (or `ub`, `unspecified` for unspecified or implementation-defined).
- **Anything else is multiple choice:** prose questions, yes/no, multi-part or platform-dependent answers, estimates. Add a `::choices` task list before `::answer`; ticked options are correct. One ticked option renders as radio buttons, several as "select all that apply" checkboxes.

  ```md
  :::predict{#P3}
  A ring buffer of 8 slots with masked indices: how many items can it hold?
  ::choices
  - [ ] 8
  - [x] 7
  - [ ] 4
  ::answer
  7, because a full buffer would look empty …
  :::
  ```

  Write 3 to 5 short, plausible options drawn from real misconceptions; don't let the right one stand out, and vary its position.
- **Bugs:** `:::bug{#U2 findings=ub}` lists the boxes a fully correct answer ticks: `ub` (including data races, dangling, out of bounds, ODR violations), `unspecified` (or implementation-defined), `compile-error`, `defined-bug` (wrong but well-defined: wrong result, leak, deadlock, performance trap) or `none` (alone). Several when the answer names several distinct problems, e.g. `findings=ub,unspecified`. Start the answer by naming the category.

`npm run check:content` also checks these: an `expect=compile-error` (or `findings=compile-error`) snippet must fail to compile, and a printing snippet must print its answer.

## Code blocks

The info string after the language carries run metadata:

| Attribute | Values | Default |
| --- | --- | --- |
| `run` | `local` (compile in the browser), `godbolt` (Compiler Explorer only), `none` (an excerpt) | `local` for C++ |
| `kind` | `program` (has `main`) or `fragment` (wrapped in a `main` with common headers) | detected |
| `note` | why it can't run here, or what differs in the browser; shown beside it | none |

A note that contains backticks needs a tilde fence (`~~~cpp note="…"`), because Markdown doesn't allow backticks in a backtick fence's info string.

## References

| Write | Renders |
| --- | --- |
| `:mod[memory-model]` | "Module 18", linked |
| `Modules :mod[containers]{bare} and :mod[hardware]{bare}` | "Modules 11 and 21", linked |
| `:sec[lock-free-programming/spsc-ring-buffer]` | "19.4": the module slug, then the heading's slug |

A reference to a module or section that doesn't exist fails the build.

## Asides and further reading

- **Go comparisons** are optional notes for Go developers. Write them as a blockquote that starts with the bold label, and keep the surrounding text complete without them:

  ```md
  > **Coming from Go?** Go slices carry their length; a C++ array decays to a bare pointer.
  ```

  They render as a marked aside. Don't put Go comparisons anywhere else (intros, item text, answers).
- **Platforms:** don't assume the reader's machine. Name macOS, Linux and Windows equivalents when a tool or API is platform-specific.
- **Deeper dives:** end a notes section with one line of links when a matching lesson exists: `*Further reading:* [Lesson title](https://www.learncpp.com/cpp-tutorial/…/)`. Use learncpp.com for core language topics and the exact cppreference.com page for library, concurrency and other topics learncpp doesn't cover.

## answers.md

Reference solutions and model outlines that don't belong to a single item. Each `##` heading becomes its own reveal in the Answer key tab.

## Common tasks

| Task | How |
| --- | --- |
| Add a module | `npm run content:new -- module <slug> [phase]`, then fill in its files |
| Add an item | `npm run content:new -- predict <module> <id>` (or `bug`, `exercise`, `question`) |
| Reorder modules | move lines in `course.yaml` |
| Reorder items | move blocks within their file |
| Remove a module or item | delete its folder (and its `course.yaml` line) or its block |

## Checks

- `npm run content:lint`: structure, ids, answers, references and folders `course.yaml` doesn't list (a second or two).
- `npm run check:content`: also compiles every runnable snippet with the in-browser toolchain and checks that predictions print what their answers say (a few minutes).
