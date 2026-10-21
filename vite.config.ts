/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { courseContent } from './scripts/content/vite-plugin.ts';
import type { ToolchainManifest } from './src/compiler/manifest.ts';

const EMPTY_FS = '\0yowasp-empty-fs';

/** The compiler bundle only imports node:fs/promises on its Node code path; give browsers an empty module. */
function yowaspBrowserFs(): Plugin {
  return {
    name: 'yowasp-browser-fs',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === 'node:fs/promises' && importer?.includes('@yowasp/clang')) return EMPTY_FS;
    },
    load(id) {
      if (id === EMPTY_FS) return 'export {};';
    },
  };
}

const LAZY = /\.(?:wasm|tar|pack)$/;

/** Emits sw.js with the list of every content-hashed file in this build (see src/sw/service-worker.js). */
function serviceWorker(): Plugin {
  return {
    name: 'learn-cpp-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((name) => name.startsWith('assets/'));
      const manifestPath = 'public/toolchain/manifest.json';
      const toolchain = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as ToolchainManifest) : undefined;
      const packs = toolchain ? [toolchain.sysroot, ...Object.values(toolchain.preludes)].map((name) => `toolchain/${name}`) : [];
      const build = {
        precache: files.filter((name) => !LAZY.test(name)),
        lazy: [...files.filter((name) => LAZY.test(name)), ...packs],
      };
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const BUILD = ${JSON.stringify(build)};\n${readFileSync('src/sw/service-worker.js', 'utf8')}`,
      });
    },
  };
}

/** Static hosts without rewrites (GitHub Pages) serve 404.html for unknown paths: make it the app. */
function spaFallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'learn-cpp-spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      copyFileSync(`${outDir}/index.html`, `${outDir}/404.html`);
    },
  };
}

// The compiler bundle resolves its .wasm files via `new URL(..., import.meta.url)`;
// pre-bundling it would break those URLs.
export default defineConfig({
  // BASE_PATH serves the app from a subpath, e.g. /learn-cpp/ on GitHub Pages.
  base: process.env.BASE_PATH ?? '/',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react(), courseContent(fileURLToPath(new URL('./content', import.meta.url))), yowaspBrowserFs(), serviceWorker(), spaFallback()],
  optimizeDeps: { exclude: ['@yowasp/clang'], include: ['@bjorn3/browser_wasi_shim'] },
  worker: { format: 'es', plugins: () => [yowaspBrowserFs()] },
  build: { target: 'es2023', chunkSizeWarningLimit: 1024 },
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
