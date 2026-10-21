# learn-cpp

An interactive course, "C++ for Low-Latency Systems": 30 modules from integer promotion to lock-free queues and tick-to-trade. Every snippet compiles and runs **in your browser**: clang 22 runs as WebAssembly and builds C++23 to wasm32-wasi, with exceptions and trap-mode UBSan. Anything WebAssembly can't do faithfully (threads, GCC, x86 assembly, TSan) opens in a prefilled Compiler Explorer session.

Each module has notes, "predict the output" and "spot the bug" items (you commit an answer before the key and the Run button unlock), graded exercises with a saved editor, and interview-question flashcards with spaced repetition. Progress stays in the browser, with JSON export and import. After the first compile, the course and compiler also work offline.

## Development

Requires Node 24 or later (scripts are TypeScript run by Node's type stripping).

```bash
npm install
```

```bash
npm run dev
```

The first `dev` or `build` runs `scripts/build-toolchain.ts`. It downloads the checksum-verified wasi-sdk 34 sysroot and builds the precompiled prelude with the same pinned `@yowasp/clang` the browser runs (about 90 s, cached in `.cache/` and `public/toolchain/`).

| Script | What it does |
| --- | --- |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (parser, wrapper, packs, traps, progress, Compiler Explorer links) |
| `npm run build` | Typecheck (`tsc -b`) and production build, including the service worker |
| `npm run test:e2e` | Playwright against the production build in Chromium, Firefox and WebKit |
| `npm run check:content` | Compiles every course snippet and runs predictions against the answer key |
| `npm run toolchain` | Rebuilds the toolchain assets |

## Content

The course lives in `content/` as Markdown and YAML: `course.yaml` orders the modules, and each module
folder holds its notes plus one file per kind of item (predict, bugs, exercises, interview), each item a
block with its answer inside it. It is compiled at build time, so numbering is derived from order and a
mistake fails the build with its file and line. [content/README.md](content/README.md) describes the format.

| Command | What it does |
| --- | --- |
| `npm run content:new -- module <slug>` | Scaffolds a module and lists it in `course.yaml` |
| `npm run content:new -- predict <module> <id>` | Appends an item block (also `bug`, `exercise`, `question`) |
| `npm run content:lint` | Checks structure, ids, answers and references (seconds) |
| `npm run check:content` | Also compiles every snippet and runs predictions against their answers (minutes) |

## Architecture

- `src/compiler/`: the in-browser toolchain. One long-lived compiler worker (`compile.ts`, shared with the Node scripts) and a fresh runner worker per program (`execute.ts`), killed on timeout. Traps are mapped to UB / terminate / assert / out-of-bounds.
- `scripts/content/`: the content compiler and its Vite plugin (one chunk per module), plus the authoring scripts.
- `src/course/`: the compiled course's types and loaders.
- `src/progress/`: the progress store (localStorage) and review scheduling.
- `src/godbolt/`: Compiler Explorer ClientState links.
- `src/sw/`: the service worker; its file list is generated at build time.

## Deployment

`.github/workflows/deploy.yml` builds, lints, tests, checks the content and deploys `dist/` to GitHub Pages on every push to `main`. To set it up, enable **Settings → Pages → Source: GitHub Actions** in the repository. The site is served from `/<repo-name>/` (via `BASE_PATH`).

GitHub Pages fits because the build ships a 72 MB compiler and 27–33 MB toolchain packs. Cloudflare Pages caps files at 25 MiB, and Netlify advises against files over 10 MB.
