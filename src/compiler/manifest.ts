import type { CppStd, Profile } from './flags.ts';

/** Written by scripts/build-toolchain.ts to public/toolchain/manifest.json. */
export interface ToolchainManifest {
  /** Hash of every input the assets depend on; a change rebuilds them. */
  key: string;
  sysroot: string;
  preludes: Record<Profile, string>;
  pchStd: CppStd;
}
