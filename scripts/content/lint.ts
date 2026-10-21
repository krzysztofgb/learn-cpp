// Checks content/ without compiling any C++: structure, ids, answers, references, and folders course.yaml
// doesn't list. Fast enough to run on every edit; `npm run check:content` also compiles and runs the code.
// Usage: npm run content:lint
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileCourse, ContentError, fsReader, unlistedModules } from './compile.ts';

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), '../../content');

try {
  const { course, modules } = compileCourse(fsReader(CONTENT));
  const unlisted = unlistedModules(CONTENT, course);
  for (const slug of unlisted) console.log(`modules/${slug}/: not listed in course.yaml`);
  const items = modules.reduce((n, m) => n + m.predict.items.length + m.ub.items.length + m.exercises.items.length + m.questions.items.length, 0);
  console.log(`${unlisted.length > 0 ? '✗' : '✓'} ${modules.length} modules in ${course.phases.length} phases, ${items} items`);
  process.exitCode = unlisted.length > 0 ? 1 : 0;
} catch (error) {
  if (!(error instanceof ContentError)) throw error;
  console.log(error.message);
  process.exitCode = 1;
}
