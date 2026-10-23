// Verifies the course content against the in-browser toolchain:
//   - every `run=local` snippet compiles (unless it's a P/U item whose answer is a compile error)
//   - every runnable prediction prints what its answer key says, when the answer is a single
//     `inline code` value; snippets carrying a `note` (a known browser difference) are reported, not failed.
// Usage: npm run check:content [-- <module number or slug>...] [--release] [--c++26] [--werror]
//   (no modules: all of them, 4 at a time; the flags pick the build options a learner can choose in the app)
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_OPTIONS, type CompileOptions } from '../src/compiler/flags.ts';
import { wrapSnippet } from '../src/compiler/wrap.ts';
import { isCppLang } from '../src/course/fence.ts';
import { normalizeOutput } from '../src/course/grade.ts';
import type { ModuleContent } from '../src/course/types.ts';
import { compileCourse, fsReader, moduleSnippets } from './content/compile.ts';
import { compile, run } from './lib/node-toolchain.ts';

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), '../content');
/** Build options a learner can pick in the app: --release, --c++26, --werror (default: Debug, C++23, no -Werror). */
const FLAGS = process.argv.slice(2).filter((arg) => arg.startsWith('--'));
const OPTIONS: CompileOptions = {
  profile: FLAGS.includes('--release') ? 'release' : DEFAULT_OPTIONS.profile,
  std: FLAGS.includes('--c++26') ? 'c++2c' : DEFAULT_OPTIONS.std,
  werror: FLAGS.includes('--werror'),
};
const COMPILE_ERROR_ANSWER = /(?:doesn't|does not|won't|fails to|not) compile|compile(?:-time)? error|ill-formed|is an error/i;

interface Finding {
  level: 'fail' | 'info';
  message: string;
}

async function checkModule(module: ModuleContent): Promise<Finding[]> {
  const findings: Finding[] = [];
  const predictions = new Map(module.predict.items.filter((item) => item.snippet).map((item) => [item.snippet!.code, item]));
  const bugs = new Map(module.ub.items.filter((item) => item.snippet).map((item) => [item.snippet!.code, item]));

  for (const snippet of moduleSnippets(module)) {
    if (!isCppLang(snippet.lang) || snippet.run !== 'local') continue;
    const prediction = predictions.get(snippet.code);
    const bug = bugs.get(snippet.code);
    const where = `${module.slug} ${prediction?.label ?? bug?.label ?? `"${snippet.code.split('\n')[0]!.slice(0, 50)}"`}`;
    const expect = prediction?.expect;
    // A snippet may fail to compile only when its item says so: the outcome, a finding, or a correct choice that names it.
    const expectsError =
      expect?.kind === 'compile-error' ||
      bug?.findings.includes('compile-error') === true ||
      (expect?.kind === 'choice' && expect.options.some((option) => option.correct && COMPILE_ERROR_ANSWER.test(option.text)));
    const compiled = await compile(wrapSnippet(snippet.code, snippet.kind), OPTIONS);
    if (!compiled.ok) {
      if (!expectsError) findings.push({ level: 'fail', message: `${where}: does not compile\n${compiled.diagnostics.split('\n').slice(0, 4).join('\n')}` });
      continue;
    }
    if (expect?.kind === 'compile-error' || bug?.findings.join() === 'compile-error') {
      findings.push({ level: 'fail', message: `${where}: compiles, but its answer says it doesn't` });
      continue;
    }
    if (expect?.kind !== 'prints') continue;
    const expected = normalizeOutput(expect.output);
    const outcome = await run(compiled.wasm);
    const actual = normalizeOutput(outcome.stdout);
    if (actual !== expected) {
      findings.push({
        level: snippet.note ? 'info' : 'fail',
        message: `${where}: printed ${JSON.stringify(actual)}, answer key says ${JSON.stringify(expected)}${snippet.note ? ' (noted)' : ''}`,
      });
    }
  }
  return findings;
}

async function main() {
  // Arguments pick modules by number or slug; none checks them all.
  const picked = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const { modules } = compileCourse(fsReader(CONTENT));

  if (picked.length === 0) {
    // Fan out: one child process per module, 4 at a time (each loads its own compiler).
    const queue = modules.map((module) => module.slug);
    let failed = false;
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const code = await new Promise<number>((resolve) => {
          const child = spawn(process.execPath, [fileURLToPath(import.meta.url), next, ...FLAGS], { stdio: ['ignore', 'pipe', 'inherit'] });
          // The compiler logs its one-time resource loading from an internal driver run; drop those lines.
          let output = '';
          child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
          child.on('exit', (exitCode) => {
            process.stdout.write(output.split('\n').filter((line) => line && !line.startsWith('yowasp-')).map((line) => `${line}\n`).join(''));
            resolve(exitCode ?? 1);
          });
        });
        failed ||= code !== 0;
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    console.log(failed ? '\ncheck:content FAILED' : '\ncheck:content passed');
    process.exitCode = failed ? 1 : 0;
    return;
  }

  let failed = false;
  for (const module of modules.filter((m) => picked.includes(m.slug) || picked.includes(String(m.number)))) {
    const findings = await checkModule(module);
    for (const finding of findings) console.log(`${finding.level === 'fail' ? 'FAIL' : 'note'} ${finding.message}`);
    failed ||= findings.some((finding) => finding.level === 'fail');
    console.log(`${failed ? '✗' : '✓'} ${module.number}. ${module.slug}`);
  }
  process.exitCode = failed ? 1 : 0;
}

await main();
