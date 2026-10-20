import type { CompileOptions, CppStd, Profile } from '../compiler/flags.ts';

const PROFILE_LABELS: Record<Profile, string> = {
  debug: 'Debug: -O0 + UBSan',
  release: 'Release: -O2, no sanitizer',
};

export function RunOptions({ options, onChange }: { options: CompileOptions; onChange: (options: CompileOptions) => void }) {
  return (
    <div className="run-options">
      <label>
        <span className="sr-only">Build profile</span>
        <select value={options.profile} onChange={(event) => onChange({ ...options, profile: event.target.value as Profile })}>
          {(Object.keys(PROFILE_LABELS) as Profile[]).map((profile) => (
            <option key={profile} value={profile}>
              {PROFILE_LABELS[profile]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">C++ standard</span>
        <select value={options.std} onChange={(event) => onChange({ ...options, std: event.target.value as CppStd })}>
          <option value="c++23">C++23</option>
          <option value="c++2c">C++26 (slower: no precompiled header)</option>
        </select>
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={options.werror} onChange={(event) => onChange({ ...options, werror: event.target.checked })} />
        -Werror
      </label>
    </div>
  );
}
