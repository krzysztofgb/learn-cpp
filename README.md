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

Modules live in `content/modules/NN-slug.md` in the course's own Markdown format. C++ code fences carry run metadata:

````markdown
```cpp kind=fragment run=local note="Shown under the code"
cout << sizeof(long);
```
````

- `kind`: `program` (has `main`) or `fragment` (wrapped in `main`, with declarations hoisted above it).
- `run`: `local` (runs in the browser), `godbolt` (Compiler Explorer only), or `none` (an excerpt).

After editing content, run `npm run check:content`.

## Architecture

- `src/compiler/`: the in-browser toolchain. One long-lived compiler worker (`compile.ts`, shared with the Node scripts) and a fresh runner worker per program (`execute.ts`), killed on timeout. Traps are mapped to UB / terminate / assert / out-of-bounds.
- `src/course/`: the course structure (`content/course.json`) and the module parser.
- `src/progress/`: the progress store (localStorage) and review scheduling.
- `src/godbolt/`: Compiler Explorer ClientState links.
- `src/sw/`: the service worker; its file list is generated at build time.

## Deployment

`.github/workflows/deploy.yml` builds, lints, tests, checks the content and deploys `dist/` to GitHub Pages on every push to `main`. To set it up, enable **Settings → Pages → Source: GitHub Actions** in the repository. The site is served from `/<repo-name>/` (via `BASE_PATH`).

GitHub Pages fits because the build ships a 72 MB compiler and 27–33 MB toolchain packs. Cloudflare Pages caps files at 25 MiB, and Netlify advises against files over 10 MB.
