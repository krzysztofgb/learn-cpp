// Serves the compiled course to the app as virtual modules (declared in src/course/virtual.d.ts):
//   virtual:learn-cpp/course          the index (phases, module titles), loaders for each module, the overview
//   virtual:learn-cpp/module/<slug>   one module's content, its own chunk, fetched when the module is opened
// A content problem fails the build, and shows Vite's error overlay in dev; editing content/ reloads the page.
import type { Plugin } from 'vite';
import { compileCourse, fsReader, type CompiledCourse } from './compile.ts';

const PREFIX = 'virtual:learn-cpp/';
const COURSE = `${PREFIX}course`;
const OVERVIEW = `${PREFIX}overview`;
const MODULE = `${PREFIX}module/`;

export function courseContent(root: string): Plugin {
  let compiled: CompiledCourse | undefined;
  const course = () => (compiled ??= compileCourse(fsReader(root)));

  return {
    name: 'learn-cpp-content',
    resolveId(id) {
      return id.startsWith(PREFIX) ? `\0${id}` : undefined;
    },
    load(id) {
      if (!id.startsWith(`\0${PREFIX}`)) return undefined;
      const { course: index, modules, overview } = course();
      const name = id.slice(1);
      if (name === COURSE) {
        const loaders = modules.map((module) => `  ${JSON.stringify(module.slug)}: () => import(${JSON.stringify(MODULE + module.slug)}),`);
        return [
          `export const course = ${JSON.stringify(index)};`,
          `export const modules = {\n${loaders.join('\n')}\n};`,
          `export const loadOverview = () => import(${JSON.stringify(OVERVIEW)});`,
        ].join('\n');
      }
      if (name === OVERVIEW) return `export default ${JSON.stringify(overview)};`;
      const module = modules.find((m) => m.slug === name.slice(MODULE.length));
      if (!module) this.error(`no module ${name.slice(MODULE.length)} in content/course.yaml`);
      return `export default ${JSON.stringify(module)};`;
    },
    configureServer(server) {
      server.watcher.add(root);
      server.watcher.on('all', (_event, file) => {
        if (!file.startsWith(root)) return;
        compiled = undefined;
        for (const [id, module] of server.moduleGraph.idToModuleMap) if (id.startsWith(`\0${PREFIX}`)) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}
