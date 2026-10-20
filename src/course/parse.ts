// Parses a module's Markdown (content/modules/*.md) into its interactive parts.
// The format is the course's own: `## Notes`, `## Predict the output` (**P1** + code), `## Spot the UB`
// (**U1** + code), `## Exercises` (**E1 ★ Title.** …), `## Interview questions` (1. …), and an
// `## Answer key` whose `###` subsections answer each part. Code fences may carry run metadata:
// ```cpp kind=fragment run=local note="…"
import { hasMain, type SnippetKind } from '../compiler/wrap.ts';
import type { Exercise, LayoutSection, ModuleContent, PredictItem, Question, RunMode, Section, SectionKind, Snippet, UbItem } from './types.ts';

interface Line {
  text: string;
  /** Inside a fenced code block (fence lines included). */
  fenced: boolean;
}

function scan(markdown: string): Line[] {
  let fence: string | null = null;
  return markdown.split('\n').map((text) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(text)?.[1];
    if (fence === null && marker) {
      fence = marker;
      return { text, fenced: true };
    }
    if (fence !== null) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && text.trim() === marker) fence = null;
      return { text, fenced: true };
    }
    return { text, fenced: false };
  });
}

const join = (lines: Line[]) =>
  lines
    .map((line) => line.text)
    .join('\n')
    .trim();

interface Part {
  heading: string;
  lines: Line[];
}

/** Splits at headings of exactly `level` outside code; the part before the first heading has heading ''. */
function splitHeadings(lines: Line[], level: number): Part[] {
  const prefix = '#'.repeat(level) + ' ';
  const parts: Part[] = [{ heading: '', lines: [] }];
  for (const line of lines) {
    if (!line.fenced && line.text.startsWith(prefix)) parts.push({ heading: line.text.slice(prefix.length).trim(), lines: [] });
    else parts.at(-1)!.lines.push(line);
  }
  return parts;
}

interface Marked {
  match: RegExpExecArray;
  /** The marker line with the marker removed, plus the following lines up to the next marker. */
  lines: Line[];
}

/** Splits at lines matching `marker` outside code; returns the intro before the first marker and each item. */
function splitMarkers(lines: Line[], marker: RegExp): { intro: Line[]; items: Marked[] } {
  const intro: Line[] = [];
  const items: Marked[] = [];
  for (const line of lines) {
    const match = line.fenced ? null : marker.exec(line.text);
    if (match) items.push({ match, lines: [{ text: line.text.slice(match[0].length), fenced: false }] });
    else (items.at(-1)?.lines ?? intro).push(line);
  }
  return { intro, items };
}

/** Removes up to `width` leading spaces from each line (list item continuation indent). */
function dedent(lines: Line[], width: number): Line[] {
  return lines.map((line) => ({ ...line, text: line.text.replace(new RegExp(`^ {0,${width}}`), '') }));
}

export function parseFenceInfo(info: string): { lang: string; attrs: Record<string, string> } {
  const [lang = '', ...rest] = info.trim().split(/\s+/);
  const attrs: Record<string, string> = {};
  for (const match of rest.join(' ').matchAll(/(\w+)=(?:"([^"]*)"|(\S+))/g)) attrs[match[1]!] = match[2] ?? match[3] ?? '';
  return { lang, attrs };
}

const RUN_MODES: RunMode[] = ['local', 'godbolt', 'none'];
const SNIPPET_LANGS = new Set(['cpp', 'c++', 'cc', 'cxx']);

export function isCppLang(lang: string): boolean {
  return SNIPPET_LANGS.has(lang.toLowerCase());
}

/** Builds a snippet from a fence's info string and code; non-C++ blocks are never runnable. */
export function snippetFromFence(info: string, code: string): Snippet {
  const { lang, attrs } = parseFenceInfo(info);
  const kind: SnippetKind = attrs.kind === 'program' || attrs.kind === 'fragment' ? attrs.kind : hasMain(code) ? 'program' : 'fragment';
  const run: RunMode = !isCppLang(lang) ? 'none' : RUN_MODES.includes(attrs.run as RunMode) ? (attrs.run as RunMode) : 'local';
  return { code, lang, kind, run, ...(attrs.note ? { note: attrs.note } : {}) };
}

/** Takes the first fenced block out of `lines`: what came before it, the snippet, and what came after. */
function takeSnippet(lines: Line[]): { before: string; snippet?: Snippet; after: string } {
  const start = lines.findIndex((line) => line.fenced);
  if (start === -1) return { before: join(lines), after: '' };
  let end = start + 1;
  while (end < lines.length && lines[end]!.fenced && !/^\s*(`{3,}|~{3,})\s*$/.test(lines[end]!.text)) end++;
  const info = lines[start]!.text.trim().replace(/^(`{3,}|~{3,})/, '');
  const code = lines
    .slice(start + 1, end)
    .map((line) => line.text)
    .join('\n');
  return { before: join(lines.slice(0, start)), snippet: snippetFromFence(info, code), after: join(lines.slice(end + 1)) };
}

/** Splits a GFM table row into cells, honoring `\|` escapes. */
export function tableCells(row: string): string[] {
  const inner = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

const stripBold = (text: string) => text.replace(/^\*\*(.*)\*\*$/, '$1').trim();

function parsePredictAnswers(lines: Line[]): Map<string, { output: string; why: string }> {
  const answers = new Map<string, { output: string; why: string }>();
  for (const line of lines) {
    if (line.fenced || !line.text.trim().startsWith('|')) continue;
    const cells = tableCells(line.text);
    const id = stripBold(cells[0] ?? '');
    if (/^[PQ]\d+$/.test(id)) answers.set(id, { output: cells[1] ?? '', why: cells[2] ?? '' });
  }
  if (answers.size > 0) return answers;
  // Fallback: answers written as `**P1:** …` paragraphs or list items.
  for (const item of splitMarkers(lines, /^(?:[-*]\s+)?\*\*([PQ]\d+):?\*\*:?\s*/).items) {
    answers.set(item.match[1]!, { output: join(dedent(item.lines, 2)), why: '' });
  }
  return answers;
}

function parseLabeledAnswers(lines: Line[], letter: string): Map<string, string> {
  const answers = new Map<string, string>();
  const marker = new RegExp(`^(?:[-*]\\s+)?\\*\\*(${letter}\\d+):?\\*\\*:?\\s*`);
  for (const item of splitMarkers(lines, marker).items) answers.set(item.match[1]!, join(dedent(item.lines, 2)));
  return answers;
}

function parseOrderedList(lines: Line[]): { intro: string; items: string[] } {
  const { intro, items } = splitMarkers(lines, /^(\d+)\.\s+/);
  return { intro: join(intro), items: items.map((item) => join(dedent(item.lines, item.match[0].length))) };
}

function parsePredict(lines: Line[], answerLines: Line[]): Section<PredictItem> {
  const answers = parsePredictAnswers(answerLines);
  // Items are P1… (Q1… in the gauntlet module).
  const { intro, items } = splitMarkers(lines, /^\*\*([PQ]\d+)\*\*\s*/);
  return {
    intro: join(intro),
    items: items.map(({ match, lines: itemLines }) => {
      const id = match[1]!;
      const { before, snippet, after } = takeSnippet(itemLines);
      return { id, prompt: before, ...(snippet ? { snippet } : {}), after, answer: answers.get(id) ?? { output: '', why: '' } };
    }),
  };
}

function parseUb(lines: Line[], answerLines: Line[]): Section<UbItem> {
  // Items are U1… ("spot the UB") or B1… ("spot the bug").
  const answers = parseLabeledAnswers(answerLines, '[UB]');
  const { intro, items } = splitMarkers(lines, /^\*\*([UB]\d+)\*\*\s*/);
  return {
    intro: join(intro),
    items: items.map(({ match, lines: itemLines }) => {
      const id = match[1]!;
      const { before, snippet, after } = takeSnippet(itemLines);
      return { id, prompt: before, ...(snippet ? { snippet } : {}), after, answer: answers.get(id) ?? '' };
    }),
  };
}

function parseExercises(lines: Line[], hintLines: Line[]): Section<Exercise> {
  const hints = parseLabeledAnswers(hintLines, 'E');
  // The course source marks difficulty with stars; the UI shows it in words.
  const { intro, items } = splitMarkers(lines, /^\*\*(E\d+)\s*(★*)\s*(.*?)\*\*\s*/); // taste-skill-ignore
  return {
    intro: join(intro),
    items: items.map(({ match, lines: itemLines }) => {
      const id = match[1]!;
      const hint = hints.get(id);
      return { id, stars: match[2]!.length, title: match[3]!.replace(/[.:]\s*$/, ''), body: join(itemLines), ...(hint ? { hint } : {}) };
    }),
  };
}

function parseQuestions(lines: Line[], answerLines: Line[]): Section<Question> {
  const questions = parseOrderedList(lines);
  const answers = parseOrderedList(answerLines).items;
  return {
    intro: questions.intro,
    items: questions.items.map((question, i) => ({ id: `Q${i + 1}`, question, answer: answers[i] ?? '' })),
  };
}

function sectionKind(heading: string): SectionKind | 'answers' {
  const lower = heading.toLowerCase();
  if (lower.startsWith('answer key')) return 'answers';
  if (lower.startsWith('notes')) return 'notes';
  if (lower.includes('predict')) return 'predict';
  if (lower.includes('spot the')) return 'ub';
  if (lower.startsWith('exercises')) return 'exercises';
  if (lower.startsWith('interview')) return 'questions';
  return 'extra';
}

const ANSWER_KEYWORDS: Partial<Record<SectionKind, RegExp>> = {
  predict: /predict/i,
  ub: /spot the/i,
  exercises: /hint/i,
  questions: /interview/i,
};

export function parseModule(markdown: string): ModuleContent {
  const lines = scan(markdown.replace(/\r\n/g, '\n'));
  const [preamble, ...parts] = splitHeadings(lines, 2);
  const titleIndex = preamble!.lines.findIndex((line) => !line.fenced && line.text.startsWith('# '));
  const title = titleIndex === -1 ? '' : preamble!.lines[titleIndex]!.text.slice(2).trim();
  const intro = join(preamble!.lines.slice(titleIndex + 1));

  const answerParts = parts.filter((part) => sectionKind(part.heading) === 'answers');
  const [answerPreamble, ...answerSubsections] = splitHeadings(answerParts.flatMap((part) => part.lines), 3);
  const used = new Set<Part>();
  // A part's answers: the subsection named for its kind, or sharing its label ("Round 1: Predict…" ↔ "Round 1").
  const answersFor = (kind: SectionKind, heading: string): Line[] => {
    const label = heading.split(':')[0]!.trim().toLowerCase();
    const match =
      answerSubsections.find((part) => !used.has(part) && ANSWER_KEYWORDS[kind]?.test(part.heading)) ??
      answerSubsections.find((part) => !used.has(part) && part.heading.toLowerCase() === label);
    if (!match) return [];
    used.add(match);
    return match.lines;
  };

  const layout: LayoutSection[] = [];
  const content: Omit<ModuleContent, 'title' | 'intro' | 'layout' | 'answerKey'> = {
    notes: '',
    predict: { intro: '', items: [] },
    ub: { intro: '', items: [] },
    exercises: { intro: '', items: [] },
    questions: { intro: '', items: [] },
  };
  for (const part of parts) {
    const kind = sectionKind(part.heading);
    if (kind === 'answers') continue;
    switch (kind) {
      case 'notes':
        content.notes = join(part.lines);
        layout.push({ kind, heading: part.heading, body: content.notes });
        break;
      case 'predict':
        content.predict = parsePredict(part.lines, answersFor(kind, part.heading));
        layout.push({ kind, heading: part.heading });
        break;
      case 'ub':
        content.ub = parseUb(part.lines, answersFor(kind, part.heading));
        layout.push({ kind, heading: part.heading });
        break;
      case 'exercises':
        content.exercises = parseExercises(part.lines, answersFor(kind, part.heading));
        layout.push({ kind, heading: part.heading });
        break;
      case 'questions':
        content.questions = parseQuestions(part.lines, answersFor(kind, part.heading));
        layout.push({ kind, heading: part.heading });
        break;
      case 'extra':
        layout.push({ kind, heading: part.heading, body: join(part.lines) });
        break;
    }
  }
  const answerKey = [
    ...(join(answerPreamble!.lines) ? [{ heading: '', body: join(answerPreamble!.lines) }] : []),
    ...answerSubsections.filter((part) => !used.has(part)).map((part) => ({ heading: part.heading, body: join(part.lines) })),
  ];
  return { title, intro, layout, ...content, answerKey };
}
