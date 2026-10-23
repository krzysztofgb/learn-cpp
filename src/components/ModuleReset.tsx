import { useState } from 'react';
import { actions, useModuleProgress } from '../progress/store.ts';
import { Button } from './arc/button/button.tsx';
import { Dialog, DialogClose, DialogContent } from './arc/dialog/dialog.tsx';

/** Clears one module's answers, exercise code and grades, after a confirmation. Hidden until there is something to clear. */
export function ModuleReset({ slug, number }: { slug: string; number: number }) {
  const progress = useModuleProgress(slug);
  const [confirming, setConfirming] = useState(false);
  const started = [progress.predictions, progress.ub, progress.exercises, progress.questions].some((part) => Object.keys(part).length > 0);
  if (!started) return null;
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
        Reset module…
      </Button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title={`Reset Module ${number}?`}
          description="Your answers, exercise code and interview grades for this module are removed, so you can work through it from the start. Other modules aren't affected."
        >
          <div className="dialog-actions">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={() => {
                actions.resetModule(slug);
                setConfirming(false);
              }}
            >
              Reset module
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
