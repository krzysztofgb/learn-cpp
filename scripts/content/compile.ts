// Compiles content/ into what the app renders (src/course/types.ts). The format is described in
// content/README.md. Markdown is parsed into a syntax tree (mdast, with GFM and directives) only to
// find structure; every string handed to the app is a slice of the author's own text, with
// cross-references resolved and notes sections numbered. All problems are collected and reported
// together, each with its file and line.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Code, Heading, Nodes, Root, RootContent } from 'mdast';
import type { ContainerDirective, TextDirective } from 'mdast-util-directive';
import { directiveFromMarkdown } from 'mdast-util-directive';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { directive } from 'micromark-extension-directive';
import { gfm } from 'micromark-extension-gfm';
import { parse as parseYaml } from 'yaml';
import { snippetFromFence } from '../../src/course/fence.ts';
import type { Course, Exercise, Expectation, Finding, Level, ModuleContent, ModuleInfo, PredictItem, Question, Section, Snippet, UbItem } from '../../src/course/types.ts';

/** Reads a file relative to the content root; undefined when it doesn't exist. */
export type Reader = (path: string) => string | undefined;

export function fsReader(root: string): Reader {
  return (path) => {
    const full = join(root, path);
    return existsSync(full) ? readFileSync(full, 'utf8') : undefined;
  };
}

/** "modules/a/predict.md:12: …" sorts by file, then line. */
function byLocation(a: string, b: string): number {
  const [fileA = '', lineA = '0'] = a.split(':');
  const [fileB = '', lineB = '0'] = b.split(':');
  return fileA.localeCompare(fileB) || Number(lineA) - Number(lineB);
}

export class ContentError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    const sorted = [...problems].sort(byLocation);
    super(`content/ has ${sorted.length} problem${sorted.length === 1 ? '' : 's'}:\n${sorted.map((p) => `  ${p}`).join('\n')}`);
    this.problems = sorted;
  }
}

export interface CompiledCourse {
  course: Course;
  modules: ModuleContent[];
  overview: string;
}

const LEVELS: Level[] = ['warm-up', 'standard', 'interview-hard'];
const EXPECTATIONS = ['prints', 'ub', 'compile-error', 'unspecified'] as const;
const FINDINGS: Finding[] = ['ub', 'unspecified', 'compile-error', 'defined-bug', 'none'];
const ID = /^[A-Za-z0-9][\w-]*$/;

/** Heading slug: lowercase words joined by hyphens; code and emphasis marks dropped ("`shared_ptr` internals" → shared-ptr-internals). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

/** Resolves `:mod[slug]` (and `:sec[slug/heading]`) for the whole course. */
interface Refs {
  modules: Map<string, ModuleInfo>;
  /** "lock-free-programming/spsc-queue" → "19.4" */
  sections: Map<string, string>;
}

/** One Markdown file: its tree, plus edits (references, section numbers) applied whenever text is sliced out of it. */
class Source {
  readonly path: string;
  readonly text: string;
  readonly tree: Root;
  private readonly problems: string[];
  private readonly edits: Edit[] = [];

  constructor(path: string, text: string, problems: string[]) {
    this.path = path;
    this.text = text;
    this.problems = problems;
    this.tree = fromMarkdown(text, { extensions: [gfm(), directive()], mdastExtensions: [gfmFromMarkdown(), directiveFromMarkdown()] });
  }

  at(node: Nodes): string {
    return `${this.path}:${node.position?.start.line ?? 0}`;
  }

  problem(node: Nodes, message: string) {
    this.problems.push(`${this.at(node)}: ${message}`);
  }

  edit(edit: Edit) {
    this.edits.push(edit);
  }

  /** Turns `:mod[slug]` into a link and `:sec[slug/heading]` into its number; reports unknown names and targets. */
  resolveReferences(refs: Refs) {
    const visit = (node: Nodes) => {
      if (node.type === 'textDirective') this.reference(node, refs);
      if ('children' in node) for (const child of node.children) visit(child as Nodes);
    };
    visit(this.tree);
  }

  private reference(node: TextDirective, refs: Refs) {
    const target = node.children.map((child) => (child.type === 'text' ? child.value : '')).join('');
    let text: string | undefined;
    if (node.name === 'mod') {
      const module = refs.modules.get(target);
      if (module) text = node.attributes?.bare === undefined ? `[Module ${module.number}](/modules/${module.slug})` : `[${module.number}](/modules/${module.slug})`;
      else this.problem(node, `:mod[${target}] names no module in course.yaml`);
    } else if (node.name === 'sec') {
      text = refs.sections.get(target);
      if (text === undefined) this.problem(node, `:sec[${target}] names no numbered notes section (expected module-slug/heading-slug)`);
    } else if (node.children.length > 0) {
      // A bare `a:b` in prose also parses as a directive; only one with a [label] is meant as one.
      this.problem(node, `unknown reference :${node.name}[…] (use :mod[…] or :sec[…])`);
    }
    if (text !== undefined) this.edit({ start: node.position!.start.offset!, end: node.position!.end.offset!, text });
  }

  /** The author's text for `nodes` (consecutive siblings), with edits applied; '' for none. */
  slice(nodes: readonly RootContent[]): string {
    if (nodes.length === 0) return '';
    const start = nodes[0]!.position!.start.offset!;
    const end = nodes.at(-1)!.position!.end.offset!;
    let out = '';
    let at = start;
    for (const edit of this.edits.filter((e) => e.start >= start && e.end <= end).sort((a, b) => a.start - b.start)) {
      out += this.text.slice(at, edit.start) + edit.text;
      at = edit.end;
    }
    return (out + this.text.slice(at, end)).trim();
  }

  /** The whole file, with edits applied. */
  all(): string {
    return this.slice(this.tree.children);
  }
}

/** Plain text of a heading, as written. */
function headingText(source: Source, heading: Heading): string {
  return source.slice(heading.children as RootContent[]);
}

interface ModuleMeta {
  title: string;
  topics: string;
  intro?: string;
  /** Label for the reading tab; "Notes" by default. */
  readingLabel?: string;
  /** Number the `###` sections of notes.md as "<module>.<n>" (default true). */
  numberSections?: boolean;
}

function readYaml<T>(read: Reader, path: string, problems: string[]): T | undefined {
  const text = read(path);
  if (text === undefined) {
    problems.push(`${path}: missing`);
    return undefined;
  }
  try {
    return parseYaml(text) as T;
  } catch (error) {
    problems.push(`${path}: ${(error as Error).message.split('\n')[0]}`);
    return undefined;
  }
}

interface CourseFile {
  title?: string;
  phases?: { title?: string; modules?: string[] }[];
}

/** A block of an item file, split at its `::answer` / `::hint` markers. */
interface Block {
  node: ContainerDirective;
  id: string;
  attributes: Record<string, string | null | undefined>;
  /** '' is the part before the first marker. */
  parts: Map<string, RootContent[]>;
}

/**
 * Reads an item file: optional intro text, then only `:::<name>{#id …}` blocks. Each block's children are
 * split at the leaf directives in `markers` (e.g. `::answer`).
 */
function readBlocks(source: Source, name: string, markers: string[], seen: Set<string>): { intro: string; blocks: Block[] } {
  const intro: RootContent[] = [];
  const blocks: Block[] = [];
  for (const node of source.tree.children) {
    if (node.type !== 'containerDirective') {
      if (blocks.length === 0 && node.type !== 'leafDirective') intro.push(node);
      else source.problem(node, blocks.length === 0 ? `a ::${node.type === 'leafDirective' ? node.name : ''} marker belongs inside a :::${name} block` : `text after a block: move it inside a :::${name} block, or before the first one`);
      continue;
    }
    if (node.name !== name) {
      source.problem(node, `:::${node.name} block in a file of :::${name} blocks`);
      continue;
    }
    const id = node.attributes?.id ?? '';
    if (!ID.test(id)) {
      source.problem(node, `:::${name} needs an id, e.g. :::${name}{#short-name}`);
      continue;
    }
    if (seen.has(id)) source.problem(node, `duplicate id #${id}`);
    seen.add(id);
    const parts = new Map<string, RootContent[]>([['', []]]);
    let current = parts.get('')!;
    for (const child of node.children) {
      if (child.type === 'leafDirective') {
        if (!markers.includes(child.name)) source.problem(child, `unknown marker ::${child.name} (expected ${markers.map((m) => `::${m}`).join(' or ')})`);
        else if (parts.has(child.name)) source.problem(child, `second ::${child.name} in #${id}`);
        else parts.set(child.name, (current = []));
        continue;
      }
      if (child.type === 'containerDirective') source.problem(child, `blocks can't be nested (:::${child.name} inside #${id})`);
      current.push(child);
    }
    blocks.push({ node, id, attributes: node.attributes ?? {}, parts });
  }
  return { intro: source.slice(intro), blocks };
}

/** Prompt, first code block and the text after it. */
function splitAtCode(source: Source, nodes: RootContent[]) {
  const index = nodes.findIndex((node) => node.type === 'code');
  if (index === -1) return { prompt: source.slice(nodes), after: '' };
  const code = nodes[index] as Code;
  return {
    prompt: source.slice(nodes.slice(0, index)),
    snippet: snippetFromFence(`${code.lang ?? ''} ${code.meta ?? ''}`, code.value),
    after: source.slice(nodes.slice(index + 1)),
  };
}

function required(source: Source, block: Block, part: string): RootContent[] {
  const nodes = block.parts.get(part);
  if (!nodes || nodes.length === 0) {
    source.problem(block.node, `#${block.id} has no ${part ? `::${part}` : 'content'}`);
    return [];
  }
  return nodes;
}

class ModuleCompiler {
  private readonly ids = { predict: new Set<string>(), bug: new Set<string>(), exercise: new Set<string>(), question: new Set<string>() };
  private readonly read: Reader;
  private readonly info: ModuleInfo;
  private readonly meta: ModuleMeta;
  private readonly problems: string[];
  /** notes.md, parsed early so the course can map section slugs to numbers before anything resolves. */
  private readonly notes: Source | undefined;

  constructor(read: Reader, info: ModuleInfo, meta: ModuleMeta, problems: string[]) {
    this.read = read;
    this.info = info;
    this.meta = meta;
    this.problems = problems;
    this.notes = this.source('notes.md');
  }

  private source(file: string): Source | undefined {
    const path = `modules/${this.info.slug}/${file}`;
    const text = this.read(path);
    return text === undefined ? undefined : new Source(path, text, this.problems);
  }

  numberSections(sections: Map<string, string>) {
    if (!this.notes || this.meta.numberSections === false) return;
    let n = 0;
    for (const node of this.notes.tree.children) {
      if (node.type !== 'heading' || node.depth !== 3 || node.children.length === 0) continue;
      const number = `${this.info.number}.${++n}`;
      sections.set(`${this.info.slug}/${slugify(headingText(this.notes, node))}`, number);
      this.notes.edit({ start: node.children[0]!.position!.start.offset!, end: node.children[0]!.position!.start.offset!, text: `${number} ` });
    }
  }

  compile(refs: Refs): ModuleContent {
    const files = {
      predict: this.source('predict.md'),
      bugs: this.source('bugs.md'),
      exercises: this.source('exercises.md'),
      interview: this.source('interview.md'),
      answers: this.source('answers.md'),
    };
    for (const source of [this.notes, ...Object.values(files)]) source?.resolveReferences(refs);
    const intro = this.meta.intro ? this.inline(`modules/${this.info.slug}/module.yaml`, this.meta.intro, refs) : '';
    return {
      ...this.info,
      intro,
      ...(this.notes ? { reading: { label: this.meta.readingLabel ?? 'Notes', body: this.notes.all() } } : {}),
      predict: files.predict ? this.predict(files.predict) : { intro: '', items: [] },
      ub: files.bugs ? this.bugs(files.bugs) : { intro: '', items: [] },
      exercises: files.exercises ? this.exercises(files.exercises) : { intro: '', items: [] },
      questions: files.interview ? this.questions(files.interview) : { intro: '', items: [] },
      answerKey: files.answers ? this.answerKey(files.answers) : [],
    };
  }

  /** Markdown kept outside a .md file (module.yaml's intro), resolved the same way. */
  private inline(path: string, text: string, refs: Refs): string {
    const source = new Source(path, text, this.problems);
    source.resolveReferences(refs);
    return source.all();
  }

  private predict(source: Source): Section<PredictItem> {
    const { intro, blocks } = readBlocks(source, 'predict', ['choices', 'answer'], this.ids.predict);
    return {
      intro,
      items: blocks.map((block, i) => {
        const answer = required(source, block, 'answer');
        const question = splitAtCode(source, required(source, block, ''));
        return {
          id: block.id,
          label: `P${i + 1}`,
          ...question,
          answer: { output: source.slice(answer.slice(0, 1)), why: source.slice(answer.slice(1)) },
          expect: this.expectation(source, block, answer[0], question.snippet !== undefined),
        };
      }),
    };
  }

  private bugs(source: Source): Section<UbItem> {
    const { intro, blocks } = readBlocks(source, 'bug', ['answer'], this.ids.bug);
    return {
      intro,
      items: blocks.map((block, i) => ({
        id: block.id,
        label: `U${i + 1}`,
        ...splitAtCode(source, required(source, block, '')),
        answer: source.slice(required(source, block, 'answer')),
        findings: this.findings(source, block),
      })),
    };
  }

  /**
   * How a prediction is answered and graded. A `::choices` task list makes it multiple choice (ticked items are correct);
   * otherwise `expect=` names the outcome, or it's inferred: an answer whose first paragraph is a single `code span`
   * is the exact output. Anything else can't be graded, which is a problem.
   */
  private expectation(source: Source, block: Block, first: RootContent | undefined, hasCode: boolean): Expectation {
    const choices = block.parts.get('choices');
    if (choices) return this.choices(source, block, choices);
    const output = first?.type === 'paragraph' && first.children.length === 1 && first.children[0]!.type === 'inlineCode' ? first.children[0].value : undefined;
    const declared = block.attributes.expect;
    if (declared) {
      if (!(EXPECTATIONS as readonly string[]).includes(declared)) {
        source.problem(block.node, `#${block.id} has expect=${declared} (expected ${EXPECTATIONS.join('|')}, or a ::choices list)`);
        return { kind: 'ub' };
      }
      if (declared !== 'prints') return { kind: declared as 'ub' | 'compile-error' | 'unspecified' };
      if (output === undefined) source.problem(block.node, `#${block.id} has expect=prints, so its answer must start with the output as one \`code\` paragraph`);
      return { kind: 'prints', output: output ?? '' };
    }
    if (hasCode && output !== undefined) return { kind: 'prints', output };
    // A block without an answer is already reported; don't report it twice.
    if (first !== undefined) source.problem(block.node, `#${block.id} can't be graded: give it a ::choices list${hasCode ? ` or expect=${EXPECTATIONS.join('|')}` : ''}`);
    return { kind: 'ub' };
  }

  /** A `::choices` part: one GitHub task list, `- [x]` for each correct option and `- [ ]` for each distractor. */
  private choices(source: Source, block: Block, nodes: RootContent[]): Expectation {
    const list = nodes.length === 1 && nodes[0]!.type === 'list' ? nodes[0] : undefined;
    // When an option starts with a code span, the parsed paragraph still covers the "[ ] " marker: drop it.
    const options = (list?.children ?? []).map((item) => ({
      text: source.slice(item.children).replace(/^\[[ xX]\]\s+/, ''),
      correct: item.checked === true,
      task: typeof item.checked === 'boolean',
    }));
    if (!list || options.some((option) => !option.task)) {
      source.problem(block.node, `#${block.id}: ::choices must be one task list ("- [x] right", "- [ ] wrong")`);
    } else if (options.length < 2 || !options.some((option) => option.correct)) {
      source.problem(block.node, `#${block.id}: ::choices needs at least two options and at least one ticked`);
    }
    return { kind: 'choice', options: options.map(({ text, correct }) => ({ text, correct })) };
  }

  /** `findings=ub,unspecified` on a bug block: the boxes a correct answer ticks. */
  private findings(source: Source, block: Block): Finding[] {
    const declared = block.attributes.findings;
    if (!declared) {
      source.problem(block.node, `#${block.id} needs findings=${FINDINGS.join(',')} (one or more)`);
      return [];
    }
    const findings = declared.split(',').map((f) => f.trim()) as Finding[];
    const unknown = findings.filter((f) => !FINDINGS.includes(f));
    if (unknown.length > 0) source.problem(block.node, `#${block.id} has unknown findings ${unknown.join(',')} (expected ${FINDINGS.join(',')})`);
    if (findings.includes('none') && findings.length > 1) source.problem(block.node, `#${block.id}: findings=none can't be combined with others`);
    return findings.filter((f) => FINDINGS.includes(f));
  }

  private exercises(source: Source): Section<Exercise> {
    const { intro, blocks } = readBlocks(source, 'exercise', ['hint'], this.ids.exercise);
    return {
      intro,
      items: blocks.map((block, i) => {
        const level = block.attributes.level as Level;
        if (!LEVELS.includes(level)) source.problem(block.node, `#${block.id} needs level=${LEVELS.join('|')}`);
        const title = block.attributes.title ?? '';
        if (!title) source.problem(block.node, `#${block.id} needs a title="…"`);
        const hint = source.slice(block.parts.get('hint') ?? []);
        return { id: block.id, label: `E${i + 1}`, level, title, body: source.slice(required(source, block, '')), ...(hint ? { hint } : {}) };
      }),
    };
  }

  private questions(source: Source): Section<Question> {
    const { intro, blocks } = readBlocks(source, 'question', ['answer'], this.ids.question);
    return {
      intro,
      items: blocks.map((block, i) => ({
        id: block.id,
        label: `Q${i + 1}`,
        question: source.slice(required(source, block, '')),
        answer: source.slice(required(source, block, 'answer')),
      })),
    };
  }

  /** One part per `##` heading; text before the first heading is a part with no heading. */
  private answerKey(source: Source): { heading: string; body: string }[] {
    const parts: { heading: string; nodes: RootContent[] }[] = [{ heading: '', nodes: [] }];
    for (const node of source.tree.children) {
      if (node.type === 'heading' && node.depth === 2) parts.push({ heading: headingText(source, node), nodes: [] });
      else parts.at(-1)!.nodes.push(node);
    }
    return parts.filter((part) => part.heading || part.nodes.length > 0).map((part) => ({ heading: part.heading, body: source.slice(part.nodes) }));
  }
}

/** Compiles the whole course. Throws a ContentError listing every problem found. */
export function compileCourse(read: Reader): CompiledCourse {
  const problems: string[] = [];
  const file = readYaml<CourseFile>(read, 'course.yaml', problems) ?? {};
  if (!file.title) problems.push('course.yaml: needs a title');
  const listed = new Set<string>();
  const compilers: ModuleCompiler[] = [];
  let number = 0;
  const phases = (file.phases ?? []).map((phase, p) => {
    if (!phase.title) problems.push(`course.yaml: phase ${p + 1} needs a title`);
    const modules: ModuleInfo[] = [];
    for (const slug of phase.modules ?? []) {
      if (listed.has(slug)) problems.push(`course.yaml: ${slug} is listed twice`);
      listed.add(slug);
      const meta = readYaml<ModuleMeta>(read, `modules/${slug}/module.yaml`, problems);
      if (!meta) continue;
      if (!meta.title || !meta.topics) problems.push(`modules/${slug}/module.yaml: needs a title and topics`);
      const info: ModuleInfo = { number: ++number, slug, title: meta.title ?? slug, topics: meta.topics ?? '' };
      modules.push(info);
      compilers.push(new ModuleCompiler(read, info, meta, problems));
    }
    return { number: p + 1, title: phase.title ?? '', modules };
  });

  const refs: Refs = { modules: new Map(phases.flatMap((phase) => phase.modules).map((m) => [m.slug, m])), sections: new Map() };
  for (const compiler of compilers) compiler.numberSections(refs.sections);
  const modules = compilers.map((compiler) => compiler.compile(refs));

  const overviewText = read('overview.md');
  let overview = '';
  if (overviewText !== undefined) {
    const source = new Source('overview.md', overviewText, problems);
    source.resolveReferences(refs);
    overview = source.all();
  }

  if (problems.length > 0) throw new ContentError(problems);
  return { course: { title: file.title!, phases }, modules, overview };
}

/** Every fenced code block in compiled Markdown, as the app would render it. */
export function codeBlocks(markdown: string): Snippet[] {
  const blocks: Snippet[] = [];
  const visit = (node: Nodes) => {
    if (node.type === 'code') blocks.push(snippetFromFence(`${node.lang ?? ''} ${node.meta ?? ''}`, node.value));
    if ('children' in node) for (const child of node.children) visit(child as Nodes);
  };
  visit(fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] }));
  return blocks;
}

/** Every runnable-looking snippet in a module: the items' own code plus code blocks inside any of its Markdown. */
export function moduleSnippets(module: ModuleContent): Snippet[] {
  const items = [...module.predict.items, ...module.ub.items];
  const markdown = [
    module.intro,
    module.reading?.body ?? '',
    ...[module.predict, module.ub, module.exercises, module.questions].map((section) => section.intro),
    ...items.flatMap((item) => [item.prompt, item.after]),
    ...module.predict.items.flatMap((item) => [item.answer.output, item.answer.why]),
    ...module.ub.items.map((item) => item.answer),
    ...module.exercises.items.flatMap((item) => [item.body, item.hint ?? '']),
    ...module.questions.items.flatMap((item) => [item.question, item.answer]),
    ...module.answerKey.map((part) => part.body),
  ];
  return [...items.flatMap((item) => (item.snippet ? [item.snippet] : [])), ...markdown.flatMap(codeBlocks)];
}

/** Module folders that course.yaml doesn't list (forgotten, or left behind after a removal). */
export function unlistedModules(root: string, course: Course): string[] {
  const listed = new Set(course.phases.flatMap((phase) => phase.modules.map((m) => m.slug)));
  const dir = join(root, 'modules');
  return existsSync(dir) ? readdirSync(dir).filter((name) => !name.startsWith('.') && !listed.has(name)) : [];
}
