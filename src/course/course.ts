import { course } from 'virtual:learn-cpp/course';
import type { ModuleInfo, Phase } from './types.ts';

export { course };

export const allModules: ModuleInfo[] = course.phases.flatMap((phase) => phase.modules);

export function findModule(slug: string | undefined): { module: ModuleInfo; phase: Phase } | undefined {
  for (const phase of course.phases) {
    const module = phase.modules.find((m) => m.slug === slug);
    if (module) return { module, phase };
  }
  return undefined;
}
