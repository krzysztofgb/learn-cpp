import { actions, useProgress } from '../progress/store.ts';

/** The learner's build settings, shared by every Run button and remembered across visits. */
export function useCompileOptions() {
  return [useProgress().options, actions.setOptions] as const;
}
