// Shared reject-and-regenerate helper (KTD4): generation stays a pure function
// of the original seed even though individual candidates can be rejected by
// the validator. Every generator's retry sequence is deriveSeed(seed, 0),
// deriveSeed(seed, 1), ... — itself a pure function of (seed, attempt) — so
// the same seed always walks the same sequence of candidates and lands on the
// same final instance.

import { deriveSeed } from '../rng';
import type { ExerciseInstance } from '../schema';
import { validate } from '../validator';

const MAX_ATTEMPTS = 25;

export function generateValidated(
  seed: number,
  build: (candidateSeed: number) => ExerciseInstance,
): ExerciseInstance {
  let lastErrors: string[] = ['(no attempts ran)'];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidateSeed = deriveSeed(seed, attempt);
    try {
      const instance = build(candidateSeed);
      const result = validate(instance);
      if (result.ok) return instance;
      lastErrors = result.errors;
    } catch (err) {
      lastErrors = [err instanceof Error ? err.message : String(err)];
    }
  }

  throw new Error(
    `generateValidated: no valid instance found within ${MAX_ATTEMPTS} attempts (seed=${seed}); last errors: ${lastErrors.join('; ')}`,
  );
}

/** Deterministic instance id from the generator's inputs, independent of how many reject-retries it took. */
export function makeInstanceId(templateId: string, grade: number, seed: number): string {
  return `${templateId}:g${grade}:s${seed}`;
}
