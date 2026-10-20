import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
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

/**
 * The build settings every Run button uses: profile, standard and -Werror.
 * On a phone they fold behind one line that names the current choice (styles.css shows the toggle there only).
 */
export function RunOptions({ options, onChange }: { options: CompileOptions; onChange: (options: CompileOptions) => void }) {
  const [open, setOpen] = useState(false);
  const controlsId = useId();
  const summary = [PROFILES.find((p) => p.value === options.profile)?.label, STANDARDS.find((s) => s.value === options.std)?.label, options.werror && '-Werror']
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="run-options">
      <button type="button" className="run-options-toggle" aria-expanded={open} aria-controls={controlsId} onClick={() => setOpen((value) => !value)}>
        <span className="muted">Build:</span> {summary}
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <div className="run-options-controls" id={controlsId} data-open={open || undefined}>
        <SegmentedControl label="Build" options={PROFILES} value={options.profile} onValueChange={(value) => onChange({ ...options, profile: value as Profile })} />
        <SegmentedControl label="C++ standard" options={STANDARDS} value={options.std} onValueChange={(value) => onChange({ ...options, std: value as CppStd })} />
        <Switch label="-Werror" checked={options.werror} onCheckedChange={(werror) => onChange({ ...options, werror })} />
      </div>
    </div>
  );
}
