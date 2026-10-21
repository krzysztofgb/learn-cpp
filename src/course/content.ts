import { loadOverview as overviewChunk, modules } from 'virtual:learn-cpp/course';
import { allModules } from './course.ts';
import type { ModuleContent } from './types.ts';

const cache = new Map<string, Promise<ModuleContent | undefined>>();

/** A module's content, fetched as its own chunk; stable per slug, so it can be passed to React's `use()`. */
export function loadModule(slug: string): Promise<ModuleContent | undefined> {
  let pending = cache.get(slug);
  if (!pending) {
    const load = modules[slug];
    pending = load ? load().then((chunk) => chunk.default) : Promise.resolve(undefined);
    cache.set(slug, pending);
  }
  return pending;
}

let overview: Promise<string> | undefined;

export function loadOverview(): Promise<string> {
  overview ??= overviewChunk().then((chunk) => chunk.default);
  return overview;
}

let everything: Promise<ModuleContent[]> | undefined;

/** Every module's content, in course order, for cross-module views (review, UB catalog, progress). */
export function loadAllModules(): Promise<ModuleContent[]> {
  everything ??= Promise.all(allModules.map((info) => loadModule(info.slug))).then((modules) => modules.filter((module) => module !== undefined));
  return everything;
}
