// Builds the in-browser C++ toolchain assets into public/toolchain/:
//   sysroot.<hash>.pack          wasi-sdk sysroot subset (exceptions-enabled libc++) + prelude.hpp
//   prelude-<profile>.<hash>.pack  prelude.pch + prelude.o for each compile profile
//   manifest.json                file names, keyed by everything the assets depend on
// The PCH must be produced by the exact clang the browser runs, so this uses the pinned
// @yowasp/clang package itself. Usage: node scripts/build-toolchain.ts [--if-missing]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clang } from '../src/compiler/compile.ts';
import { encodePack, fromEntries, type Tree } from '../src/compiler/pack.ts';
import { languageFlags, PCH_STD, PROFILES, type Profile } from '../src/compiler/flags.ts';
import type { ToolchainManifest } from '../src/compiler/manifest.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache');
const OUT = join(ROOT, 'public', 'toolchain');

const SYSROOT_VERSION = '34.0';
const SYSROOT_URL = `https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-34/wasi-sysroot-${SYSROOT_VERSION}.tar.gz`;
const SYSROOT_SHA256 = '9d813544eeebe38b7b8f2244ed591de46b6db812c6dd1a257ff9f0d2a905a2be';
const TARGET = 'wasm32-wasip1';

const sha256 = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
const log = (message: string) => console.log(`[toolchain] ${message}`);

function inputsKey(): string {
  const clangVersion = JSON.parse(readFileSync(join(ROOT, 'node_modules/@yowasp/clang/package.json'), 'utf8')).version;
  const inputs = [
    clangVersion,
    SYSROOT_SHA256,
    readFileSync(join(ROOT, 'toolchain/prelude.hpp'), 'utf8'),
    readFileSync(join(ROOT, 'src/compiler/flags.ts'), 'utf8'),
    readFileSync(join(ROOT, 'src/compiler/pack.ts'), 'utf8'),
    readFileSync(fileURLToPath(import.meta.url), 'utf8'),
  ];
  return sha256(inputs.join('\0')).slice(0, 16);
}

async function fetchSysroot(): Promise<string> {
  const archive = join(CACHE, `wasi-sysroot-${SYSROOT_VERSION}.tar.gz`);
  const dir = join(CACHE, `wasi-sysroot-${SYSROOT_VERSION}`);
  if (existsSync(join(dir, 'VERSION'))) return dir;
  mkdirSync(CACHE, { recursive: true });
  if (!existsSync(archive)) {
    log(`downloading ${SYSROOT_URL}`);
    const response = await fetch(SYSROOT_URL);
    if (!response.ok) throw new Error(`sysroot download failed: HTTP ${response.status}`);
    writeFileSync(archive, new Uint8Array(await response.arrayBuffer()));
  }
  const digest = sha256(readFileSync(archive));
  if (digest !== SYSROOT_SHA256) {
    rmSync(archive);
    throw new Error(`sysroot checksum mismatch: got ${digest}, expected ${SYSROOT_SHA256}`);
  }
  execFileSync('tar', ['xzf', archive, '-C', CACHE]);
  return dir;
}

/** Only the exceptions-enabled wasm32-wasip1 variant: no LTO archives, shared objects or other targets. */
function sysrootFiles(sysroot: string): [string, Uint8Array][] {
  const files: [string, Uint8Array][] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name === 'noeh' || name === 'llvm-lto') continue;
        walk(path);
      } else if (!name.endsWith('.so')) {
        files.push([`sysroot/${relative(sysroot, path)}`, new Uint8Array(readFileSync(path))]);
      }
    }
  };
  walk(join(sysroot, 'include', TARGET));
  walk(join(sysroot, 'lib', TARGET));
  return files;
}

async function clangOutput(args: string[], files: Tree, output: string): Promise<Uint8Array> {
  const result = await clang(args, files, output);
  if (!result.output) throw new Error(`clang ${args.join(' ')} failed:\n${result.stderr}`);
  return result.output;
}

async function buildPrelude(profile: Profile, tree: Tree): Promise<[string, Uint8Array][]> {
  const flags = languageFlags({ profile, std: PCH_STD });
  const pch = await clangOutput(
    [...flags, '-Xclang', '-fno-pch-timestamp', '-fpch-instantiate-templates', '-fpch-codegen', '-x', 'c++-header', 'prelude.hpp', '-o', 'prelude.pch'],
    tree,
    'prelude.pch',
  );
  const object = await clangOutput([...flags, '-c', 'prelude.pch', '-o', 'prelude.o'], { ...tree, 'prelude.pch': pch }, 'prelude.o');
  return [['prelude.pch', pch], ['prelude.o', object]];
}

function writePack(name: string, files: [string, Uint8Array][]): string {
  const packed = encodePack(files);
  const fileName = `${name}.${sha256(packed).slice(0, 12)}.pack`;
  writeFileSync(join(OUT, fileName), packed);
  log(`${fileName}: ${files.length} files, ${(packed.length / 1e6).toFixed(1)} MB`);
  return fileName;
}

async function main() {
  const key = inputsKey();
  const manifestPath = join(OUT, 'manifest.json');
  if (process.argv.includes('--if-missing') && existsSync(manifestPath)) {
    const current = JSON.parse(readFileSync(manifestPath, 'utf8')) as ToolchainManifest;
    if (current.key === key) return;
  }
  const started = performance.now();
  const sysroot = await fetchSysroot();
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const prelude: [string, Uint8Array] = ['prelude.hpp', new Uint8Array(readFileSync(join(ROOT, 'toolchain/prelude.hpp')))];
  const files = [...sysrootFiles(sysroot), prelude];
  const tree = fromEntries(files);
  const manifest: ToolchainManifest = {
    key,
    sysroot: writePack('sysroot', files),
    preludes: {} as Record<Profile, string>,
    pchStd: PCH_STD,
  };
  for (const profile of PROFILES) {
    log(`building prelude PCH for ${profile}`);
    manifest.preludes[profile] = writePack(`prelude-${profile}`, await buildPrelude(profile, tree));
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  log(`done in ${((performance.now() - started) / 1000).toFixed(0)} s`);
}

await main();
