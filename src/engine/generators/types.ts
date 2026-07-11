// Shared generator contract (U6-U8): every Tier-A generator is a pure
// (grade, seed) -> instance projection (KTD4).

import type { ExerciseInstance } from '../schema';

export interface GenerateOptions {
  grade: number;
  seed: number;
}

export type Generator = (opts: GenerateOptions) => ExerciseInstance;
