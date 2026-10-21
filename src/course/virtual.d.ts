// The compiled course, served by scripts/content/vite-plugin.ts.
declare module 'virtual:learn-cpp/course' {
  export const course: import('./types.ts').Course;
  /** One loader per module slug; each module is its own chunk. */
  export const modules: Record<string, () => Promise<{ default: import('./types.ts').ModuleContent }>>;
  export const loadOverview: () => Promise<{ default: string }>;
}
