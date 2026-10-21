import { Suspense, use, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { loadAllModules } from '../course/content.ts';
import { actions, isModuleDone, parseProgress, useProgress } from '../progress/store.ts';
import { Badge } from '../components/arc/badge/badge.tsx';
import { Button } from '../components/arc/button/button.tsx';
import { Dialog, DialogClose, DialogContent } from '../components/arc/dialog/dialog.tsx';
import Toast from '../components/arc/toast/toast.tsx';
import { PageTitle } from '../components/PageTitle.tsx';

export function ProgressPage() {
  return (
    <article className="page">
      <PageTitle>Progress</PageTitle>
      <header className="title-row with-actions">
        <div>
          <h1>Progress</h1>
          <p className="subtitle">Saved in this browser only. Export it to move it to another browser or keep a backup.</p>
        </div>
        <BackupControls />
      </header>
      <Suspense fallback={<p className="muted">Loading modules…</p>}>
        <ProgressTable />
      </Suspense>
    </article>
  );
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

interface PendingImport {
  name: string;
  text: string;
  modules: number;
  answers: number;
}

function BackupControls() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState<{ title: string; description?: string } | null>(null);

  const exportProgress = () => {
    const blob = new Blob([actions.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `learn-cpp-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Validate before asking: a bad file is reported at once and never offered as a replacement.
  const chooseImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    try {
      const progress = parseProgress(text);
      const modules = Object.values(progress.modules);
      const answers = modules.reduce((n, m) => n + Object.keys(m.predictions).length + Object.keys(m.ub).length, 0);
      setPending({ name: file.name, text, modules: modules.length, answers });
    } catch (error) {
      setToast({ title: 'Couldn’t import that file', description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <div className="title-actions">
      <Button variant="secondary" onClick={exportProgress}>
        Export progress
      </Button>
      <Button variant="secondary" onClick={() => fileInput.current?.click()}>
        Import…
      </Button>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => void chooseImport(event)} />
      <Button variant="ghost" onClick={() => setConfirmReset(true)}>
        Reset all
      </Button>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent
          title="Replace progress in this browser?"
          description={pending ? `${pending.name}: ${count(pending.modules, 'module')} started, ${count(pending.answers, 'answer')}. What this browser has now will be replaced.` : ''}
        >
          <div className="dialog-actions">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (!pending) return;
                actions.importJson(pending.text);
                setToast({ title: `Imported ${pending.name}` });
                setPending(null);
              }}
            >
              Replace progress
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent title="Delete all progress in this browser?" description="Answers, exercise code and review history are removed. Export a backup first if you might want them back.">
          <div className="dialog-actions">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={() => {
                actions.resetAll();
                setConfirmReset(false);
                setToast({ title: 'Progress deleted' });
              }}
            >
              Delete progress
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* A toast with a sentence to read stays up longer than a one-line confirmation. */}
      {toast && <Toast title={toast.title} description={toast.description} duration={toast.description ? 8000 : undefined} open onOpenChange={(open) => !open && setToast(null)} />}
    </div>
  );
}

function Ratio({ done, total }: { done: number; total: number }) {
  if (total === 0) return <span className="missing">–</span>;
  return (
    <>
      {done}
      <span className="of">/{total}</span>
    </>
  );
}

function ProgressTable() {
  const modules = use(loadAllModules());
  const progress = useProgress();
  const rows = modules.map((content) => {
    const module = progress.modules[content.slug];
    const questionIds = content.questions.items.map((q) => q.id);
    return {
      info: content,
      predict: [Object.keys(module?.predictions ?? {}).length, content.predict.items.length] as const,
      bugs: [Object.keys(module?.ub ?? {}).length, content.ub.items.length] as const,
      exercises: [Object.values(module?.exercises ?? {}).filter((e) => e.done).length, content.exercises.items.length] as const,
      interview: [questionIds.filter((id) => ['good', 'easy'].includes(module?.questions[id]?.grade ?? '')).length, questionIds.length] as const,
      done: isModuleDone(module, questionIds),
    };
  });
  // The total row is summed from the rows as shown.
  const sum = (key: 'predict' | 'bugs' | 'exercises' | 'interview') =>
    rows.reduce<[number, number]>((total, row) => [total[0] + row[key][0], total[1] + row[key][1]], [0, 0]);
  const totals = { predict: sum('predict'), bugs: sum('bugs'), exercises: sum('exercises'), interview: sum('interview') };
  const doneCount = rows.filter((row) => row.done).length;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="sr-only">Progress by module</caption>
        <thead>
          <tr>
            <th scope="col">Module</th>
            <th scope="col" className="num">Predict</th>
            <th scope="col" className="num">Bugs</th>
            <th scope="col" className="num">Exercises</th>
            <th scope="col" className="num">Interview</th>
            <th scope="col" className="status-col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.info.slug}>
              <th scope="row">
                <Link to={`/modules/${row.info.slug}`}>
                  <span className="module-number">{row.info.number}</span> {row.info.title}
                </Link>
              </th>
              <td className="num"><Ratio done={row.predict[0]} total={row.predict[1]} /></td>
              <td className="num"><Ratio done={row.bugs[0]} total={row.bugs[1]} /></td>
              <td className="num"><Ratio done={row.exercises[0]} total={row.exercises[1]} /></td>
              <td className="num"><Ratio done={row.interview[0]} total={row.interview[1]} /></td>
              <td className="status-col">{row.done ? <Badge tone="success" size="sm">Done</Badge> : <span className="missing">–</span>}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">All modules</th>
            <td className="num"><Ratio done={totals.predict[0]} total={totals.predict[1]} /></td>
            <td className="num"><Ratio done={totals.bugs[0]} total={totals.bugs[1]} /></td>
            <td className="num"><Ratio done={totals.exercises[0]} total={totals.exercises[1]} /></td>
            <td className="num"><Ratio done={totals.interview[0]} total={totals.interview[1]} /></td>
            <td className="status-col"><Ratio done={doneCount} total={rows.length} /></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
