// Scaffolds content (see content/README.md):
//   npm run content:new -- module <slug> [phase number]     a module folder, listed at the end of the phase (default: last)
//   npm run content:new -- predict|bug|exercise|question <module slug> <id>
// Items are appended to the end of their file; move the block to reorder it.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument, YAMLSeq } from 'yaml';

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), '../../content');
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const TEMPLATES = {
  predict: { file: 'predict.md', block: (id: string) => `:::predict{#${id}}\n\`\`\`cpp\n// code\n\`\`\`\n::answer\n\`output\`\n\nWhy it prints that.\n:::\n` },
  bug: { file: 'bugs.md', block: (id: string) => `:::bug{#${id}}\n\`\`\`cpp\n// code\n\`\`\`\n::answer\nThe rule it breaks, and the fix.\n:::\n` },
  exercise: { file: 'exercises.md', block: (id: string) => `:::exercise{#${id} level=standard title="Title"}\nWhat to build.\n::hint\nA nudge (optional).\n:::\n` },
  question: { file: 'interview.md', block: (id: string) => `:::question{#${id}}\nThe question?\n::answer\nThe model answer.\n:::\n` },
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [kind, slug, arg] = process.argv.slice(2);
if (!kind || !slug) fail('usage: npm run content:new -- module <slug> [phase] | predict|bug|exercise|question <module> <id>');

if (kind === 'module') {
  if (!SLUG.test(slug)) fail(`${slug}: use lowercase words joined by hyphens`);
  const dir = join(CONTENT, 'modules', slug);
  if (existsSync(dir)) fail(`modules/${slug} already exists`);
  const coursePath = join(CONTENT, 'course.yaml');
  const course = parseDocument(readFileSync(coursePath, 'utf8'));
  const phases = course.get('phases') as YAMLSeq;
  const index = arg ? Number(arg) - 1 : phases.items.length - 1;
  const modules = course.getIn(['phases', index, 'modules']) as YAMLSeq | undefined;
  if (!modules) fail(`course.yaml has no phase ${arg}`);
  modules.add(slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'module.yaml'), `title: ${slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())}\ntopics: One line of topics\nintro: |\n  Why this module matters.\n`);
  writeFileSync(join(dir, 'notes.md'), '### First section\n\nNotes.\n');
  writeFileSync(coursePath, course.toString({ lineWidth: 0 }));
  console.log(`created modules/${slug}/ (module.yaml, notes.md) and listed it in phase ${index + 1} of course.yaml`);
} else if (kind in TEMPLATES) {
  const template = TEMPLATES[kind as keyof typeof TEMPLATES];
  if (!arg || !/^[A-Za-z0-9][\w-]*$/.test(arg)) fail('give the new item an id, e.g. cas-fails');
  const dir = join(CONTENT, 'modules', slug);
  if (!existsSync(dir)) fail(`no module folder modules/${slug}`);
  const path = join(dir, template.file);
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (existing.includes(`{#${arg}`)) fail(`${template.file} already has #${arg}`);
  appendFileSync(path, `${existing && !existing.endsWith('\n\n') ? (existing.endsWith('\n') ? '\n' : '\n\n') : ''}${template.block(arg)}`);
  console.log(`added #${arg} to modules/${slug}/${template.file}`);
} else {
  fail(`unknown kind ${kind}: module, predict, bug, exercise or question`);
}
