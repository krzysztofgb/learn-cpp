import courseJson from '../../content/course.json' with { type: 'json' };

export type Runner = 'local' | 'godbolt' | 'prose';

export interface ModuleInfo {
  number: number;
  slug: string;
  title: string;
  topics: string;
}

export interface Phase {
  number: number;
  title: string;
  defaultRunner: Runner;
  modules: ModuleInfo[];
}

export interface Course {
  title: string;
  phases: Phase[];
}

export const course = courseJson as Course;

export const allModules: ModuleInfo[] = course.phases.flatMap((phase) => phase.modules);

export function findModule(slug: string | undefined): { module: ModuleInfo; phase: Phase } | undefined {
  for (const phase of course.phases) {
    const module = phase.modules.find((m) => m.slug === slug);
    if (module) return { module, phase };
  }
  return undefined;
}
