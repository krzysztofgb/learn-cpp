// Turns a course snippet into a compilable program.
// Most "predict the output" snippets are statements that "sit inside main"; some also declare
// types or functions, which C++ doesn't allow inside a function. A fragment is split into
// top-level items: declarations are hoisted above main, statements go inside it, and every item
// keeps its original line numbers via #line so diagnostics point at what the learner sees.

export type SnippetKind = 'program' | 'fragment';

export const SOURCE_NAME = 'main.cpp';

interface Item {
  text: string;
  /** 1-based line of the item's first character. */
  line: number;
}

const CONTROL_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'do', 'else', 'try', 'catch', 'return', 'co_return']);
const CONTINUATION_KEYWORDS = new Set(['else', 'catch', 'while']);
const TYPE_KEYWORDS = /^(?:typedef\s+)?(?:struct|class|union|enum)\b/;
const HOISTED_PREFIX = /^(?:template\b|namespace\b|extern\s+"C"|inline\b|constinit\b|concept\b|using\s+namespace\b)/;

export function hasMain(code: string): boolean {
  return /\bint\s+main\s*\(/.test(stripCommentsAndStrings(code));
}

/** Replaces comments and string/char literals with spaces, keeping offsets and newlines intact. */
export function stripCommentsAndStrings(code: string): string {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const c = code[i]!;
    const next = code[i + 1];
    if (c === '/' && next === '/') {
      while (i < code.length && code[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else if (c === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2);
      const stop = end === -1 ? code.length : end + 2;
      for (; i < stop; i++) out += code[i] === '\n' ? '\n' : ' ';
    } else if (c === 'R' && next === '"' && !/\w/.test(code[i - 1] ?? '')) {
      // Raw string literal R"delim(...)delim"
      const open = code.indexOf('(', i);
      const delimiter = code.slice(i + 2, open);
      const end = code.indexOf(`)${delimiter}"`, open);
      const stop = end === -1 ? code.length : end + delimiter.length + 2;
      out += 'R"';
      for (i += 2; i < stop - 1; i++) out += code[i] === '\n' ? '\n' : ' ';
      out += '"';
      i = stop;
    } else if (c === '"' || (c === "'" && !/[0-9a-fA-F]/.test(code[i - 1] ?? ''))) {
      // A quote after a hex digit is a digit separator (1'000'000), not a character literal.
      out += c;
      i++;
      while (i < code.length && code[i] !== c && code[i] !== '\n') {
        if (code[i] === '\\') {
          out += ' ';
          i++;
        }
        out += ' ';
        i++;
      }
      if (i < code.length) out += code[i++];
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function lineAt(code: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) if (code[i] === '\n') line++;
  return line;
}

function nextToken(stripped: string, from: number): { token: string; start: number } {
  let i = from;
  while (i < stripped.length && /\s/.test(stripped[i]!)) i++;
  const match = /^(?:[A-Za-z_]\w*|.)/.exec(stripped.slice(i));
  return { token: match?.[0] ?? '', start: i };
}

/** Whether a top-level `{...}` whose opening brace follows `head` ends the item (a block) or not (an initializer or type body). */
function closesItem(head: string, isFirstBrace: boolean): boolean {
  const unattributed = head.replace(/^(?:\[\[[^\]]*\]\]\s*)+/, '').replace(/^template\s*<[^{]*>\s*/, '');
  if (TYPE_KEYWORDS.test(unattributed) && isFirstBrace) return false; // declarators may follow: struct S {...} s;
  if (head === '' || /^(?:namespace|extern)\b/.test(head)) return true;
  if (/[=,]$/.test(head)) return false; // = {...} or a braced list element
  if (/\)\s*(?:const|volatile|noexcept(?:\s*\([^)]*\))?|override|final|mutable|&&?|->[^{]+|\s)*$/.test(head)) return true;
  if (/\b(?:else|try|do)$/.test(head)) return true;
  return false; // T x{...} or a lambda []{...}: the statement continues to its `;`
}

/** Splits code into top-level items: preprocessor lines, `;`-terminated statements and braced blocks. */
export function splitTopLevel(code: string): Item[] {
  const stripped = stripCommentsAndStrings(code);
  const items: Item[] = [];
  let depth = 0;
  let start = -1;
  let open = -1;
  let braces = 0;
  const push = (end: number) => {
    const raw = code.slice(start, end);
    const text = raw.trim();
    if (text) items.push({ text, line: lineAt(code, start + raw.length - raw.trimStart().length) });
    start = -1;
    braces = 0;
  };
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i]!;
    if (start === -1) {
      if (/\s/.test(c)) continue;
      start = i;
      if (c === '#') {
        // A preprocessor directive runs to the end of the line (honoring backslash continuations).
        let end = i;
        while (end < stripped.length && !(stripped[end] === '\n' && stripped[end - 1] !== '\\')) end++;
        push(end);
        i = end;
        continue;
      }
    }
    if (c === '(' || c === '[' || c === '{') {
      if (c === '{' && depth === 0) {
        open = i;
        braces++;
      }
      depth++;
    } else if (c === ')' || c === ']' || c === '}') {
      depth = Math.max(0, depth - 1);
      if (c === '}' && depth === 0) {
        const { token, start: tokenStart } = nextToken(stripped, i + 1);
        if (token === ';') {
          push(tokenStart + 1);
          i = tokenStart;
        } else if (!CONTINUATION_KEYWORDS.has(token) && closesItem(stripped.slice(start, open).trim(), braces === 1)) {
          push(i + 1);
        }
      }
    } else if (c === ';' && depth === 0) {
      push(i + 1);
    }
  }
  if (start !== -1) push(stripped.length);
  return items;
}

/** True for items that must live at namespace scope: types, templates, function definitions, directives. */
export function isTopLevelDeclaration(text: string): boolean {
  const code = stripCommentsAndStrings(text).trim();
  if (code.startsWith('#')) return true;
  const unattributed = code.replace(/^(?:\[\[[^\]]*\]\]\s*)+/, '');
  if (HOISTED_PREFIX.test(unattributed)) return true;
  if (TYPE_KEYWORDS.test(unattributed)) return true;
  if (!unattributed.endsWith('}')) return false;
  // A function definition: `<return type> <name>(<params>) <qualifiers> {` with no `=` before the body.
  const brace = unattributed.indexOf('{');
  const head = unattributed.slice(0, brace).trim();
  const first = /^[A-Za-z_]\w*/.exec(head)?.[0] ?? '';
  if (CONTROL_KEYWORDS.has(first) || head.includes('=') || head === '') return false;
  return /[\w>\]&*]\s+[~\w:<>]+\s*\([^]*\)\s*(?:const|volatile|noexcept(?:\s*\([^)]*\))?|override|final|&&?|->[^{]+|\s)*$/.test(head);
}

/** The program actually compiled for a snippet. `#line` directives map diagnostics back to the snippet. */
export function wrapSnippet(code: string, kind: SnippetKind, { lineDirectives = true } = {}): string {
  const at = (line: number) => (lineDirectives ? [`#line ${line} "${SOURCE_NAME}"`] : []);
  if (kind === 'program') return [...at(1), code].join('\n');
  const top: string[] = [];
  const body: string[] = [];
  for (const item of splitTopLevel(code)) {
    (isTopLevelDeclaration(item.text) ? top : body).push(...at(item.line), item.text);
  }
  return ['using namespace std;', ...top, 'int main() {', ...body, '}', ''].join('\n');
}
