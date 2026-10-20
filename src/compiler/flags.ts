// Compiler flags shared by the toolchain build script (Node) and the compiler worker.

/** `debug` mirrors the course's sanitizer build; `release` its "see what -O2 does with UB" build. */
export type Profile = 'debug' | 'release';
export type CppStd = 'c++23' | 'c++2c';

export interface CompileOptions {
  profile: Profile;
  std: CppStd;
  werror: boolean;
}

export const DEFAULT_OPTIONS: CompileOptions = { profile: 'debug', std: 'c++23', werror: false };

/** Targets the exceptions-enabled (`eh`) libc++ variant of the wasi-sdk 34 sysroot. */
export const TOOLCHAIN_FLAGS = [
  '--target=wasm32-wasip1',
  '--sysroot=sysroot',
  '-nostdinc++',
  '-isystem',
  'sysroot/include/wasm32-wasip1/eh/c++/v1',
  '-fwasm-exceptions',
  '-mllvm',
  '-wasm-use-legacy-eh=false',
];

/** Exporting the C++ exception tag lets the runner read an exception that escapes main(). */
export const LINK_FLAGS = ['-Lsysroot/lib/wasm32-wasip1/eh', '-lunwind', '-Wl,--export=__cpp_exception'];

export const WARNING_FLAGS = ['-Wall', '-Wextra', '-Wpedantic', '-Wconversion', '-Wshadow'];

const PROFILE_FLAGS: Record<Profile, string[]> = {
  debug: ['-O0', '-fsanitize=undefined', '-fsanitize-trap=undefined'],
  release: ['-O2'],
};

/** Flags that change language options; a precompiled header is only valid for an exact match. */
export function languageFlags(options: Pick<CompileOptions, 'profile' | 'std'>): string[] {
  return [...TOOLCHAIN_FLAGS, `-std=${options.std}`, ...PROFILE_FLAGS[options.profile]];
}

export const PCH_STD: CppStd = 'c++23';

/** Name of the prebuilt prelude variant for these options, or null to compile without a PCH. */
export function preludeVariant(options: Pick<CompileOptions, 'profile' | 'std'>): Profile | null {
  return options.std === PCH_STD ? options.profile : null;
}

/** The flags a learner chooses, as they'd type them for clang++ on their own machine (no wasm toolchain plumbing). */
export function commandFlags(options: CompileOptions): string[] {
  return [`-std=${options.std}`, ...PROFILE_FLAGS[options.profile], ...WARNING_FLAGS, ...(options.werror ? ['-Werror'] : [])];
}

export function compileFlags(options: CompileOptions): string[] {
  return [...TOOLCHAIN_FLAGS, ...commandFlags(options)];
}

export const PROFILES: Profile[] = ['debug', 'release'];
