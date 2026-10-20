// Commit-before-reveal forms. Each question gets the standard control that fits its answer:
// one outcome → radio buttons, several findings → checkboxes, open-ended → a text box.
// The controls are Arc's (src/components/arc).
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from './arc/button/button.tsx';
import { Checkbox } from './arc/checkbox/checkbox.tsx';
import { RadioGroup } from './arc/radio-group/radio-group.tsx';
import { Textarea } from './arc/textarea/textarea.tsx';

function CommitForm({ onSubmit, valid, children }: { onSubmit: () => void; valid: boolean; children: ReactNode }) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onSubmit();
  };
  return (
    <form className="commit-form" onSubmit={submit}>
      {children}
      <div className="commit-row">
        <Button type="submit" size="sm" disabled={!valid}>
          Commit and reveal
        </Button>
      </div>
    </form>
  );
}

type Outcome = 'prints' | 'ub' | 'compile-error' | 'unspecified';

const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: 'prints', label: 'It prints…' },
  { value: 'ub', label: 'Undefined behavior' },
  { value: 'compile-error', label: "It doesn't compile" },
  { value: 'unspecified', label: 'Unspecified or implementation-defined' },
];

/** "Predict the output" for a code snippet: exactly one outcome, plus the output when there is one. */
export function PredictForm({ onCommit }: { onCommit: (answer: string) => void }) {
  const [outcome, setOutcome] = useState<Outcome | ''>('');
  const [output, setOutput] = useState('');
  const valid = outcome !== '' && (outcome !== 'prints' || output.trim() !== '');
  const submit = () => {
    const label = OUTCOMES.find((option) => option.value === outcome)!.label;
    if (outcome === 'prints') onCommit(`Prints: ${output.trim()}`);
    else onCommit(output.trim() ? `${label}: ${output.trim()}` : label);
  };
  return (
    <CommitForm onSubmit={submit} valid={valid}>
      <RadioGroup label="What happens when it runs?" options={OUTCOMES} value={outcome} onValueChange={(value) => setOutcome(value as Outcome)} />
      {outcome === 'prints' && <Textarea className="mono-input" label="Exact output" value={output} onChange={(event) => setOutput(event.target.value)} rows={2} />}
      {outcome === 'unspecified' && (
        <Textarea className="mono-input" label="Likely output on your machine (optional)" value={output} onChange={(event) => setOutput(event.target.value)} rows={2} />
      )}
    </CommitForm>
  );
}

/** A prediction asked in words (no code to run): free-form only. */
export function OpenAnswerForm({ label, placeholder, onCommit }: { label: string; placeholder?: string; onCommit: (answer: string) => void }) {
  const [text, setText] = useState('');
  return (
    <CommitForm onSubmit={() => onCommit(text.trim())} valid={text.trim() !== ''}>
      <Textarea label={label} value={text} onChange={(event) => setText(event.target.value)} placeholder={placeholder} rows={2} />
    </CommitForm>
  );
}

const NOTHING_WRONG = 'Nothing wrong';
const FINDINGS = ['Undefined behavior', 'Unspecified or implementation-defined', "Doesn't compile", 'A bug, but defined behavior', NOTHING_WRONG];

/** "Spot the bug": several findings can apply to one snippet, then the rule and the fix in words. */
export function FindingsForm({ onCommit }: { onCommit: (answer: string) => void }) {
  const [findings, setFindings] = useState<string[]>([]);
  const [explanation, setExplanation] = useState('');
  const toggle = (finding: string, checked: boolean) => {
    // "Nothing wrong" excludes every other finding, and the other way round.
    if (!checked) setFindings((current) => current.filter((f) => f !== finding));
    else if (finding === NOTHING_WRONG) setFindings([NOTHING_WRONG]);
    else setFindings((current) => [...current.filter((f) => f !== NOTHING_WRONG), finding]);
  };
  const submit = () => {
    const ordered = FINDINGS.filter((finding) => findings.includes(finding)).join('; ');
    onCommit(explanation.trim() ? `${ordered}. ${explanation.trim()}` : ordered);
  };
  return (
    <CommitForm onSubmit={submit} valid={findings.length > 0}>
      <fieldset className="choice-group">
        <legend className="field-label">What's wrong with it? Select all that apply.</legend>
        <div className="choice-list">
          {FINDINGS.map((finding) => (
            <Checkbox key={finding} label={finding} checked={findings.includes(finding)} onCheckedChange={(checked) => toggle(finding, checked === true)} />
          ))}
        </div>
      </fieldset>
      <Textarea
        label="Which rule does it break, and how would you fix it? (optional)"
        value={explanation}
        onChange={(event) => setExplanation(event.target.value)}
        placeholder="e.g. signed overflow when x == INT_MAX; check before adding"
        rows={2}
      />
    </CommitForm>
  );
}
