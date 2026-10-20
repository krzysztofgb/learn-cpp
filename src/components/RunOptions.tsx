import type { CompileOptions, CppStd, Profile } from '../compiler/flags.ts';
import SegmentedControl from './arc/segmented-control/segmented-control.tsx';
import { Switch } from './arc/switch/switch.tsx';

const PROFILES = [
  { value: 'debug', label: 'Debug · UBSan' },
  { value: 'release', label: 'Release · O2' },
];

const STANDARDS = [
  { value: 'c++23', label: 'C++23' },
  { value: 'c++2c', label: 'C++26' },
];

/** The build settings every Run button uses: profile, standard and -Werror. */
export function RunOptions({ options, onChange }: { options: CompileOptions; onChange: (options: CompileOptions) => void }) {
  return (
    <div className="run-options">
      <SegmentedControl label="Build" options={PROFILES} value={options.profile} onValueChange={(value) => onChange({ ...options, profile: value as Profile })} />
      <SegmentedControl label="C++ standard" options={STANDARDS} value={options.std} onValueChange={(value) => onChange({ ...options, std: value as CppStd })} />
      <Switch label="-Werror" checked={options.werror} onCheckedChange={(werror) => onChange({ ...options, werror })} />
    </div>
  );
}
