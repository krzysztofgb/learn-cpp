import { Suspense, use, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { loadAllModules } from '../course/content.ts';
import { actions, isModuleDone, useProgress } from '../progress/store.ts';

export function ProgressPage() {
  return (
    <article className="page wide">
      <h1>Your progress</h1>
      <p className="lede">Progress is saved in this browser only. Export it to move it to another browser or keep a backup.</p>
      <BackupControls />
      <Suspense fallback={<p className="muted">Loading modules…</p>}>
        <ProgressTable />
      </Suspense>
    </article>
  );
}

function BackupControls() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const exportProgress = () => {
    const blob = new Blob([actions.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `learn-cpp-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importProgress = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!window.confirm('Replace the progress in this browser with the imported file?')) return;
    try {
      actions.importJson(await file.text());
      setMessage({ kind: 'ok', text: `Imported ${file.name}.` });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'That file could not be imported.' });
    }
  };

  const reset = () => {
    if (window.confirm('Delete all progress in this browser? Export a backup first if you might want it back.')) {
      actions.resetAll();
      setMessage({ kind: 'ok', text: 'Progress cleared.' });
    }
  };

  return (
    <div className="filters">
      <button type="button" className="button" onClick={exportProgress}>
        Export progress
      </button>
      <button type="button" className="button" onClick={() => fileInput.current?.click()}>
        Import…
      </button>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => void importProgress(event)} />
      <button type="button" className="button ghost" onClick={reset}>
        Reset all
      </button>
      {message && (
        <span className={`badge ${message.kind === 'ok' ? 'ok' : 'error'}`} role="status">
          {message.text}
        </span>
      )}
    </div>
  );
}

function ProgressTable() {
  const modules = use(loadAllModules());
  const progress = useProgress();
  const ratio = (done: number, total: number) => (total === 0 ? '–' : `${done}/${total}`);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Module</th>
            <th>Predict</th>
            <th>Bugs</th>
            <th>Exercises</th>
            <th>Interview</th>
            <th>Done</th>
          </tr>
        </thead>
        <tbody>
          {modules.map(({ info, content }) => {
            const module = progress.modules[info.slug];
            const questionIds = content.questions.items.map((q) => q.id);
            const strong = questionIds.filter((id) => ['good', 'easy'].includes(module?.questions[id]?.grade ?? '')).length;
            return (
              <tr key={info.slug}>
                <td>
                  <Link to={`/modules/${info.slug}`}>
                    {info.number}. {info.title}
                  </Link>
                </td>
                <td>{ratio(Object.keys(module?.predictions ?? {}).length, content.predict.items.length)}</td>
                <td>{ratio(Object.keys(module?.ub ?? {}).length, content.ub.items.length)}</td>
                <td>{ratio(Object.values(module?.exercises ?? {}).filter((e) => e.done).length, content.exercises.items.length)}</td>
                <td>{ratio(strong, questionIds.length)}</td>
                <td>{isModuleDone(module, questionIds) ? '✓' : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
