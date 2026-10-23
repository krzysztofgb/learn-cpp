// Code fences carry run metadata in their info string: ```cpp kind=fragment run=local compare=gcc note="…"
import { hasMain, type SnippetKind } from '../compiler/wrap.ts';
import type { RunMode, Snippet } from './types.ts';

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
  return { code, lang, kind, run, ...(attrs.note ? { note: attrs.note } : {}), ...(attrs.compare === 'gcc' ? { compareGcc: true as const } : {}) };
}
