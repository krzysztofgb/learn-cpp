## How the course works

The course has 30 modules in 8 phases, from first principles to C++26, written for an engineer who already knows Go and systems well. Each module has its own page and follows the same structure.

1. **Notes:** the concepts, with the rules stated precisely enough to answer interview follow-ups. Go comparisons appear where they help.
2. **Predict the output:** short snippets. Write down what prints, or name the UB, before checking the key.
3. **Spot the UB:** code that compiles cleanly but is broken. Name the rule it violates.
4. **Exercises:** graded Warm-up, Standard or Interview-hard. Compile each with the sanitizer flags from the Setup section.
5. **Interview questions:** questions asked verbatim in low-latency C++ interviews. Answer out loud in 60–90 seconds, then check.
6. **Answer key:** each answer stays hidden until you commit to your own. Running a snippet unlocks at the same time.

Undefined behavior (UB) and trick questions run through every module, so by Module 27 the catalog is review. Mark a module done only when you can answer its interview questions without notes.

## Setup

You need two compilers and one set of flags. Apple Clang lags behind upstream on C++23/26 features, so install upstream LLVM and GCC from Homebrew.

```bash
brew install llvm gcc
# Upstream clang (adjust the path if Homebrew is elsewhere)
export PATH="$(brew --prefix llvm)/bin:$PATH"
```

Compile every exercise twice: once with Clang and once with GCC. When the two disagree on a "predict the output" snippet, that disagreement is usually the lesson.

```bash
# Debug build: warnings as errors, plus address and UB sanitizers
clang++ -std=c++23 -O0 -g -Wall -Wextra -Wpedantic -Wconversion -Wshadow -Werror \
  -fsanitize=address,undefined -fno-omit-frame-pointer ex.cpp -o ex

# Concurrency modules: the thread sanitizer replaces address (they can't be combined)
clang++ -std=c++23 -O1 -g -fsanitize=thread ex.cpp -o ex

# See what the optimizer does with UB
clang++ -std=c++23 -O2 ex.cpp -o ex
```

Use `-std=c++2c` (C++26) only in the modules that need it; compiler support for C++26 is still partial. Valgrind doesn't run on Apple Silicon, so the sanitizers are your memory checkers.

Keep [Compiler Explorer](https://godbolt.org) open in a tab. Interviews show x86-64 assembly, while your Mac runs ARM64. Compiler Explorer lets you read both, and it's the fastest way to check what `-O2` did to your code.

The primary references are [cppreference.com](https://en.cppreference.com) for the library and the [C++ draft standard](https://eel.is/c++draft/) for language rules. When an answer key cites a rule, it uses the standard's section name, such as \[basic.life\].

