// Verifies the course content against the in-browser toolchain:
//   - every `run=local` snippet compiles (unless it's a P/U item whose answer is a compile error)
//   - every runnable prediction prints what its answer key says, when the answer is a single
//     `inline code` value; snippets carrying a `note` (a known browser difference) are reported, not failed.
// Usage: npm run check:content [-- <module number or slug>...]   (none: all modules, 4 at a time)
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_OPTIONS } from '../src/compiler/flags.ts';
import { wrapSnippet } from '../src/compiler/wrap.ts';
import { isCppLang } from '../src/course/fence.ts';
import type { ModuleContent } from '../src/course/types.ts';
import { compileCourse, fsReader, moduleSnippets } from './content/compile.ts';
import { compile, run } from './lib/node-toolchain.ts';

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), '../content');
const COMPILE_ERROR_ANSWER = /(?:doesn't|does not|won't|fails to|not) compile|compile(?:-time)? error|ill-formed|is an error/i;

interface Finding {
  level: 'fail' | 'info';
  message: string;
}

/** The single exact output an answer names, e.g. "`0 5 5`"; undefined when it isn't checkable. */
function expectedOutput(answer: string): string | undefined {
  const codes = [...answer.matchAll(/`([^`]*)`/g)].map((match) => match[1]!);
  return codes.length === 1 && answer.replace(/`[^`]*`/, '').trim() === '' ? codes[0] : undefined;
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
    const answer = prediction ? `${prediction.answer.output} ${prediction.answer.why}` : bug?.answer;
    const compiled = await compile(wrapSnippet(snippet.code, snippet.kind), DEFAULT_OPTIONS);
    const expectsError = answer !== undefined && COMPILE_ERROR_ANSWER.test(answer);
    if (!compiled.ok) {
      if (!expectsError) findings.push({ level: 'fail', message: `${where}: does not compile\n${compiled.diagnostics.split('\n').slice(0, 4).join('\n')}` });
      continue;
    }
    if (!prediction) continue;
    const expected = expectedOutput(prediction.answer.output);
    if (expected === undefined) continue;
    const outcome = await run(compiled.wasm);
    const actual = outcome.stdout.trim();
    if (actual !== expected.trim()) {
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
  const picked = process.argv.slice(2);
  const { modules } = compileCourse(fsReader(CONTENT));

  if (picked.length === 0) {
    // Fan out: one child process per module, 4 at a time (each loads its own compiler).
    const queue = modules.map((module) => module.slug);
    let failed = false;
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const code = await new Promise<number>((resolve) => {
          const child = spawn(process.execPath, [fileURLToPath(import.meta.url), next], { stdio: ['ignore', 'pipe', 'inherit'] });
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
