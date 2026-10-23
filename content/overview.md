## How the course works

The course has 30 modules in 8 phases, from first principles to C++26, written for an engineer who already knows systems programming in some language. Each module has its own page and follows the same structure.

> **Coming from Go?** Some notes include asides like this one that compare C++ with Go, for Go developers. They are optional: the text around them stands on its own, so skip them if Go isn't your background.

1. **Notes:** the concepts, with the rules stated precisely enough to answer interview follow-ups, and links to learncpp.com or cppreference.com for a deeper dive.
2. **Predict the output:** short snippets. Write down what prints, or name the UB, before checking the key.
3. **Spot the UB:** code that compiles cleanly but is broken. Name the rule it violates.
4. **Exercises:** graded Warm-up, Standard or Interview-hard. Compile each with the sanitizer flags from the Setup section.
5. **Interview questions:** questions asked verbatim in low-latency C++ interviews. Answer out loud in 60–90 seconds, then check.
6. **Answer key:** each answer stays hidden until you commit to your own. Running a snippet unlocks at the same time.

Undefined behavior (UB) and trick questions run through every module, so by :mod[ub-and-trick-question-gauntlet] the catalog is review. Mark a module done only when you can answer its interview questions without notes.

## Setup

Everything in the course runs in this page, but you'll also want two compilers on your own machine: a recent Clang and a recent GCC, with one set of flags. C++23 support needs Clang 18 or GCC 14 or newer.

**macOS:** Apple Clang lags behind upstream on C++23/26 features, so install upstream LLVM and GCC from Homebrew.

```bash
brew install llvm gcc
# Upstream clang (adjust the path if Homebrew is elsewhere)
export PATH="$(brew --prefix llvm)/bin:$PATH"
```

**Linux (Debian, Ubuntu):** install both from the package manager. If its Clang is older than 18, the [LLVM apt repository](https://apt.llvm.org) has current releases.

```bash
sudo apt install clang g++
```

**Windows:** use [WSL 2](https://learn.microsoft.com/windows/wsl/install) with Ubuntu and follow the Linux steps. The flags below are Clang and GCC flags; MSVC has AddressSanitizer but no undefined-behavior or thread sanitizer.

Compile every exercise twice: once with Clang and once with GCC. When the two disagree on a "predict the output" snippet, that disagreement is usually the lesson.

```bash
# Debug build: warnings as errors, plus address and UB sanitizers
clang++ -std=c++23 -O0 -g -Wall -Wextra -Wpedantic -Wconversion -Wshadow -Werror -fsanitize=address,undefined -fno-omit-frame-pointer ex.cpp -o ex

# Concurrency modules: the thread sanitizer replaces address (they can't be combined)
clang++ -std=c++23 -O1 -g -fsanitize=thread ex.cpp -o ex

# See what the optimizer does with UB
clang++ -std=c++23 -O2 ex.cpp -o ex
```

Use `-std=c++2c` (C++26) only in the modules that need it; compiler support for C++26 is still partial. Treat the sanitizers as your memory checkers everywhere: Valgrind works on Linux but not on Apple Silicon Macs.

Keep [Compiler Explorer](https://godbolt.org) open in a tab. Interviews usually show x86-64 assembly, whatever your own machine runs (Apple Silicon Macs and many cloud servers are ARM64). Compiler Explorer lets you read both, and it's the fastest way to check what `-O2` did to your code.

The primary references are [cppreference.com](https://en.cppreference.com) for the library and the [C++ draft standard](https://eel.is/c++draft/) for language rules. When an answer key cites a rule, it uses the standard's section name, such as \[basic.life\].

