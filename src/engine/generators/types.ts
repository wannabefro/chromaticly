// Shared generator contract: every Tier-A generator is a pure
// (grade, seed, atoms) -> instance projection (KTD4). `atoms` is the lesson's
// declared SRS atoms — the per-lesson scope a generator samples within, so a
// lesson teaches exactly its own content rather than the grade-wide scope.
// Generators that are in-scope by construction (interval variants) accept the
// field and ignore it; note_naming and key_signature_id derive their pool from it.

import type { ExerciseInstance } from '../schema';

export interface GenerateOptions {
  grade: number;
  seed: number;
  atoms: string[];
}

export type Generator = (opts: GenerateOptions) => ExerciseInstance;
