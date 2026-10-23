// Commit-before-reveal forms. Every answer is something the app can grade: one outcome → radio buttons (plus the
// exact output when it prints), multiple choice → radio buttons or checkboxes, several findings → checkboxes.
// No free text except an exact program output. The controls are Arc's (src/components/arc).
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import type { Outcome, PredictionAnswer } from '../course/grade.ts';
import { FINDING_LABELS, OUTCOME_LABELS } from '../course/labels.ts';
import type { Choice, Finding } from '../course/types.ts';
import { Button } from './arc/button/button.tsx';
import { Checkbox } from './arc/checkbox/checkbox.tsx';
import { RadioGroup } from './arc/radio-group/radio-group.tsx';
import { Textarea } from './arc/textarea/textarea.tsx';
import { InlineMarkdown } from './Markdown.tsx';

/** `missing` says what's still needed while the answer is incomplete, so the disabled button explains itself. */
function CommitForm({ onSubmit, missing, children }: { onSubmit: () => void; missing: string | null; children: ReactNode }) {
  const hintId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!missing) onSubmit();
  };
  return (
    <form className="commit-form" onSubmit={submit}>
      {children}
      <div className="commit-row">
        {missing && (
          <span className="commit-hint" id={hintId}>
            {missing}
          </span>
        )}
        <Button type="submit" size="sm" disabled={missing !== null} aria-describedby={missing ? hintId : undefined}>
          Commit and reveal
        </Button>
      </div>
    </form>
  );
}

const OUTCOMES = (Object.keys(OUTCOME_LABELS) as Outcome[]).map((value) => ({ value, label: OUTCOME_LABELS[value] }));

/** "Predict the output" for a code snippet: exactly one outcome, plus the exact output when it prints. */
export function PredictForm({ onCommit }: { onCommit: (answer: string, prediction: PredictionAnswer) => void }) {
  const [outcome, setOutcome] = useState<Outcome | ''>('');
  const [output, setOutput] = useState('');
  const missing = outcome === '' ? 'Choose what happens.' : outcome === 'prints' && output.trim() === '' ? 'Type the exact output.' : null;
  const submit = () => {
    if (outcome === 'prints') onCommit(`Prints: ${output.trim()}`, { outcome, output: output.trim() });
    else if (outcome !== '') onCommit(OUTCOME_LABELS[outcome], { outcome });
  };
  return (
    <CommitForm onSubmit={submit} missing={missing}>
      <RadioGroup label="What happens when it runs?" options={OUTCOMES} value={outcome} onValueChange={(value) => setOutcome(value as Outcome)} />
      {outcome === 'prints' && <Textarea className="mono-input" label="Exact output" value={output} onChange={(event) => setOutput(event.target.value)} rows={2} />}
    </CommitForm>
  );
}

/** Multiple choice: radio buttons when one option is right, checkboxes ("select all that apply") when several are. */
export function ChoiceForm({ options, onCommit }: { options: Choice[]; onCommit: (answer: string, prediction: PredictionAnswer) => void }) {
  const multiple = options.filter((option) => option.correct).length > 1;
  const [chosen, setChosen] = useState<number[]>([]);
  const submit = () => {
    const picked = [...chosen].sort((a, b) => a - b);
    onCommit(picked.map((i) => options[i]!.text).join('; '), { choices: picked });
  };
  return (
    <CommitForm onSubmit={submit} missing={chosen.length === 0 ? (multiple ? 'Select at least one answer.' : 'Choose an answer.') : null}>
      {multiple ? (
        <fieldset className="choice-group">
          <legend className="field-label">Select all that apply.</legend>
          <div className="choice-list">
            {options.map((option, i) => (
              <Checkbox
                key={i}
                label={<InlineMarkdown text={option.text} />}
                checked={chosen.includes(i)}
                onCheckedChange={(checked) => setChosen((current) => (checked === true ? [...current, i] : current.filter((c) => c !== i)))}
              />
            ))}
          </div>
        </fieldset>
      ) : (
        <RadioGroup
          label="Your answer"
          options={options.map((option, i) => ({ value: String(i), label: <InlineMarkdown text={option.text} /> }))}
          value={chosen.length ? String(chosen[0]) : ''}
          onValueChange={(value) => setChosen([Number(value)])}
        />
      )}
    </CommitForm>
  );
}

const FINDINGS = Object.keys(FINDING_LABELS) as Finding[];

/** "Spot the bug": the findings that apply; the answer then names the rule and the fix. */
export function FindingsForm({ onCommit }: { onCommit: (answer: string, findings: Finding[]) => void }) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const toggle = (finding: Finding, checked: boolean) => {
    // "Nothing wrong" excludes every other finding, and the other way round.
    if (!checked) setFindings((current) => current.filter((f) => f !== finding));
    else if (finding === 'none') setFindings(['none']);
    else setFindings((current) => [...current.filter((f) => f !== 'none'), finding]);
  };
  const submit = () => {
    const ordered = FINDINGS.filter((finding) => findings.includes(finding));
    onCommit(ordered.map((finding) => FINDING_LABELS[finding]).join('; '), ordered);
  };
  return (
    <CommitForm onSubmit={submit} missing={findings.length === 0 ? 'Select at least one finding.' : null}>
      <fieldset className="choice-group">
        <legend className="field-label">What's wrong with it? Select all that apply.</legend>
        <div className="choice-list">
          {FINDINGS.map((finding) => (
            <Checkbox key={finding} label={FINDING_LABELS[finding]} checked={findings.includes(finding)} onCheckedChange={(checked) => toggle(finding, checked === true)} />
          ))}
        </div>
      </fieldset>
    </CommitForm>
  );
}
