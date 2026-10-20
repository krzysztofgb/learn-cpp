import { allModules, type ModuleInfo } from './course.ts';
import { parseModule } from './parse.ts';
import type { ModuleContent } from './types.ts';

// Each module's Markdown is its own chunk, fetched when the module is opened.
const sources = import.meta.glob<string>('../../content/modules/*.md', { query: '?raw', import: 'default' });
const overviewSource = import.meta.glob<string>('../../content/overview.md', { query: '?raw', import: 'default' });

const cache = new Map<string, Promise<ModuleContent | undefined>>();

/** Stable per slug, so it can be passed to React's `use()`. */
export function loadModule(slug: string): Promise<ModuleContent | undefined> {
  let pending = cache.get(slug);
  if (!pending) {
    const load = sources[`../../content/modules/${slug}.md`];
    pending = load ? load().then(parseModule) : Promise.resolve(undefined);
    cache.set(slug, pending);
  }
  return pending;
}

let overview: Promise<string> | undefined;

export function loadOverview(): Promise<string> {
  const load = overviewSource['../../content/overview.md'];
  overview ??= load ? load() : Promise.resolve('');
  return overview;
}

export function hasModuleContent(slug: string): boolean {
  return `../../content/modules/${slug}.md` in sources;
}


export interface LoadedModule {
  info: ModuleInfo;
  content: ModuleContent;
}

let everything: Promise<LoadedModule[]> | undefined;

/** Every module's content, for cross-module views (review, UB catalog, progress). */
export function loadAllModules(): Promise<LoadedModule[]> {
  everything ??= Promise.all(allModules.map(async (info) => ({ info, content: await loadModule(info.slug) }))).then((modules) =>
    modules.filter((module): module is LoadedModule => module.content !== undefined),
  );
  return everything;
}
