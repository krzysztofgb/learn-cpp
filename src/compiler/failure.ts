// What to tell the learner when the toolchain itself failed (not their program). The raw message
// stays available under "Details" for bug reports.

export function describeFailure(raw: string): string {
  if (/did not respond in time/i.test(raw)) return 'The compiler took too long to answer. Run again; if it keeps happening, reload the page.';
  // Chrome: "Failed to fetch"; Firefox: "NetworkError…"; Safari: "Load failed".
  if (/fetch|network|load failed|download|HTTP \d{3}|manifest/i.test(raw)) {
    return 'Couldn’t download the compiler. Check your connection and run again; after one successful run it also works offline.';
  }
  return 'Running this failed unexpectedly. Run again, or reload the page if it keeps happening.';
}
