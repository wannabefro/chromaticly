// U4 — grade-2 capability ledger (plan 2026-07-18-002, D6).
//
// Every registered generator must at least produce grade-2-VALID content when
// handed grade: 2 — passing both the validator and an independent recheck
// against scopeForGrade(2) here (not just a restatement of the validator's own
// checkScope). Per D6 ("render only what you can render"), that content is
// either genuinely grade-2 (the safe dimensions: clefs, noteValues, keysMajor,
// pitchRanges, intervalRule) or grade-1-meter/grade-2-valid (the deferred
// meter/rhythm/passage/bar generators, which must never silently emit a /2
// bar). Each case below names the later slice that upgrades it — this file is
// the executable ledger of what still needs grade-2 work.

import type { Music, MusicEvent } from '../../music/types';
import { keyAccidentals } from '../../music/abc-emitter';
import { renderableTimeSignatures, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { validate } from '../validator';
import { buildContextPassage } from './context-passage';
import { generate, GENERATORS } from './index';
import { atomsForLesson, atomsForTemplate } from './test-helpers';

const SEEDS = Array.from({ length: 30 }, (_, i) => i);
const WIDE_SEEDS = Array.from({ length: 150 }, (_, i) => i);

const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Independent (not-validator-internal) pitch ordinal, mirroring the pattern
 *  already used by add-time-signature.test.ts/bar-validity.test.ts's own unit
 *  tables — a real recheck, not a restatement of validator.ts's checkScope. */
function pitchOrdinal(pitch: string): number {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(pitch);
  if (!m) throw new Error(`grade2-smoke: unexpected pitch "${pitch}"`);
  return Number(m[3]) * 7 + LETTER_ORDER.indexOf(m[1]);
}

function eventPitches(ev: MusicEvent): string[] {
  if (ev.type === 'note') return [ev.pitch];
  if (ev.type === 'chord') return ev.pitches;
  return [];
}

/** Independent recheck that every clef/key/time-sig/note-value/pitch an
 *  instance renders is inside scopeForGrade(2) — separate from (and in
 *  addition to) validate()'s own scope check. */
function assertWithinGrade2Scope(music: Music | null): void {
  if (!music) return;
  const scope = scopeForGrade(2);
  expect(scope.clefs).toContain(music.clef);

  if (music.key_sig != null) {
    const [tonic, mode] = music.key_sig.split('_');
    const pool = mode === 'minor' ? scope.keysMinor : scope.keysMajor;
    expect(pool).toContain(tonic);
  }
  if (music.time_sig != null) {
    expect(scope.timeSignatures).toContain(music.time_sig);
  }

  const range = scope.pitchRanges[music.clef];
  for (const voice of music.voices) {
    for (const ev of voice.events) {
      if (ev.type === 'note' || ev.type === 'chord' || ev.type === 'rest') {
        expect(scope.noteValues).toContain(ev.dur);
      }
      for (const pitch of eventPitches(ev)) {
        expect(pitchOrdinal(pitch)).toBeGreaterThanOrEqual(pitchOrdinal(range.low));
        expect(pitchOrdinal(pitch)).toBeLessThanOrEqual(pitchOrdinal(range.high));
      }
    }
  }
}

function assertValidatorClean(instance: ExerciseInstance): void {
  expect(validate(instance)).toEqual({ ok: true, errors: [] });
}

const RENDERABLE_G2 = renderableTimeSignatures(2);

function assertRenderableTimeSigOnly(music: Music | null): void {
  if (!music || music.time_sig == null) return;
  expect(RENDERABLE_G2).toContain(music.time_sig);
}

describe('grade-2 smoke — every registered generator is exercised', () => {
  test('the ledger below covers every GENERATORS entry (no template silently unpinned)', () => {
    const covered = [
      'note_naming',
      'interval_naming',
      'interval_naming_stave_input',
      'rhythm_sum',
      'key_signature_id',
      'term_meaning',
      'term_meaning_flashcard',
      'bar_validity',
      'add_time_signature',
      'note_value_compare',
      'music_in_context',
    ];
    expect(new Set(covered)).toEqual(new Set(Object.keys(GENERATORS)));
  });

  // note_naming derives its pool from lesson atoms, not scope (D6/U4 files
  // note) — genuine grade-2 note pools arrive with the grade-2 pitch-content
  // slice that writes grade-2 lessons/atoms.
  test('note_naming @ grade 2: atom-scoped, ignores grade — validator- and scope-clean', () => {
    const atoms = atomsForLesson('treble-notes');
    for (const seed of SEEDS) {
      const instance = generate('note_naming', { grade: 2, seed, atoms });
      assertValidatorClean(instance);
      assertWithinGrade2Scope(instance.stimulus.music as Music | null);
    }
  });

  // Safe dimension (D6): clefs/keysMajor/pitchRanges are read from
  // scopeForGrade(2). The grade-2 pitch-content slice must additionally fix
  // the flat-tonic lookup gap noted below before Bb/Eb become reachable.
  test('interval_naming @ grade 2: validator- and scope-clean across seeds', () => {
    for (const seed of SEEDS) {
      const instance = generate('interval_naming', { grade: 2, seed, atoms: [] });
      assertValidatorClean(instance);
      assertWithinGrade2Scope(instance.stimulus.music as Music | null);
    }
  });

  test('interval_naming_stave_input @ grade 2: validator- and scope-clean across seeds', () => {
    for (const seed of SEEDS) {
      const instance = generate('interval_naming_stave_input', { grade: 2, seed, atoms: [] });
      assertValidatorClean(instance);
      assertWithinGrade2Scope(instance.stimulus.music as Music | null);
    }
  });

  // rhythm_sum keeps its own RHYTHM_SUM_VALUES table and never reads scope
  // (plan Risk 5) — the grade-2 rhythm-devices slice must give it a
  // grade-aware palette; this case only proves grade: 2 tagging is harmless.
  test('rhythm_sum @ grade 2: validator-clean (own internal table, scope-independent)', () => {
    for (const seed of SEEDS) {
      const instance = generate('rhythm_sum', { grade: 2, seed, atoms: [] });
      assertValidatorClean(instance);
    }
  });

  // Safe dimension (D6): clefs read from scopeForGrade(2); the key pool comes
  // from the passed atoms (unaffected by this slice — see U5). Same flat-tonic
  // gap as interval_naming below.
  test('key_signature_id @ grade 2: validator- and scope-clean across seeds', () => {
    const atoms = atomsForLesson('key-signatures');
    for (const seed of SEEDS) {
      const instance = generate('key_signature_id', { grade: 2, seed, atoms });
      assertValidatorClean(instance);
      assertWithinGrade2Scope(instance.stimulus.music as Music | null);
    }
  });

  // TERMS_DECK_G1 is a grade-1-only vocabulary — the grade-2 terms slice adds
  // a grade-aware deck; these cases only prove grade: 2 tagging is harmless.
  test('term_meaning @ grade 2: validator-clean (grade-1-only deck, scope-independent)', () => {
    const atoms = atomsForLesson('terms-and-signs');
    for (const seed of SEEDS) {
      const instance = generate('term_meaning', { grade: 2, seed, atoms });
      assertValidatorClean(instance);
    }
  });

  test('term_meaning_flashcard @ grade 2: validator-clean (grade-1-only deck, scope-independent)', () => {
    const atoms = atomsForLesson('terms-and-signs');
    for (const seed of SEEDS) {
      const instance = generate('term_meaning_flashcard', { grade: 2, seed, atoms });
      assertValidatorClean(instance);
    }
  });

  // Deferred meter dimension (D6): sources time signatures from
  // renderableTimeSignatures(grade), the /4 subset, until the time-signatures
  // slice teaches minim-beat bar math for grade-2's /2 meters.
  test('bar_validity @ grade 2: validator- and scope-clean, time_sig always /4', () => {
    for (const seed of SEEDS) {
      const instance = generate('bar_validity', { grade: 2, seed, atoms: [] });
      assertValidatorClean(instance);
      assertWithinGrade2Scope(instance.stimulus.music as Music | null);
      assertRenderableTimeSigOnly(instance.stimulus.music as Music | null);
    }
  });

  test('add_time_signature @ grade 2: validator- and scope-clean, canonical + distractors always /4', () => {
    for (const seed of SEEDS) {
      const instance = generate('add_time_signature', { grade: 2, seed, atoms: [] });
      assertValidatorClean(instance);
      assertWithinGrade2Scope(instance.stimulus.music as Music | null);
      expect(RENDERABLE_G2).toContain(instance.answer.canonical);
      for (const d of instance.distractors as string[]) expect(RENDERABLE_G2).toContain(d);
    }
  });

  // Safe dimension (D6): pitch range widens per scopeForGrade(2); noteValues
  // stay unchanged (D2 table — no G2 adds), so genuine grade-2 content here is
  // the wider pitch range, proven below.
  test('note_value_compare @ grade 2: validator- and scope-clean across seeds', () => {
    for (const seed of SEEDS) {
      const instance = generate('note_value_compare', { grade: 2, seed, atoms: [] });
      assertValidatorClean(instance);
      assertWithinGrade2Scope(instance.stimulus.music as Music | null);
    }
  });

  test('music_in_context (find_the_bar) @ grade 2: validator- and scope-clean, time_sig always /4', () => {
    const atoms = atomsForLesson('music-in-context');
    for (const seed of SEEDS) {
      const instance = generate('music_in_context', { grade: 2, seed, atoms });
      assertValidatorClean(instance);
      assertWithinGrade2Scope(instance.stimulus.music as Music | null);
      assertRenderableTimeSigOnly(instance.stimulus.music as Music | null);
    }
  });
});

// context-passage.ts's buildContextPassage is the passage path (SetRunner
// routes music_in_context here, not through GENERATORS — see
// seed-stability.test.ts) — its own RNG surface, so it gets its own case,
// mirroring the deferred-meter assertion above.
describe('grade-2 smoke — music_in_context passage (buildContextPassage, not GENERATORS-routed)', () => {
  test('every sub-question is validator- and scope-clean, and time_sig is always /4', () => {
    const atoms = atomsForLesson('music-in-context');
    for (const seed of SEEDS) {
      const passage = buildContextPassage({ grade: 2, seed, atoms });
      assertWithinGrade2Scope(passage.music);
      assertRenderableTimeSigOnly(passage.music);
      for (const question of passage.questions) {
        assertValidatorClean(question);
      }
    }
  });
});

describe('grade-2 smoke — genuine grade-2 content is reachable (not just grade-2-valid)', () => {
  test('note_value_compare reaches pitches outside the grade-1 pitch range across seeds', () => {
    const g1 = scopeForGrade(1).pitchRanges;
    let found = false;
    for (const seed of WIDE_SEEDS) {
      const instance = generate('note_value_compare', { grade: 2, seed, atoms: [] });
      const music = instance.stimulus.music as Music;
      const range = g1[music.clef];
      for (const ev of music.voices[0].events) {
        for (const pitch of eventPitches(ev)) {
          if (pitchOrdinal(pitch) < pitchOrdinal(range.low) || pitchOrdinal(pitch) > pitchOrdinal(range.high)) {
            found = true;
          }
        }
      }
    }
    expect(found).toBe(true);
  });

  // Bb/Eb are added to scopeForGrade(2).keysMajor, but diatonicPitchesInRange
  // only enumerates natural letters, so `p.startsWith('Bb'|'Eb')` never
  // matches and sampleInterval/tonicPitchInRange throw for those two tonics —
  // silently retried away here, and a hard failure for key_signature_id (see
  // below). A major (3 sharps, no accidental in its own letter) is the
  // reachable grade-2-added key and is what this slice can honestly claim;
  // fixing the flat-tonic lookup is residual work for the pitch-content slice.
  test('interval_naming reaches the grade-2-added A major key across seeds', () => {
    let found = false;
    for (const seed of WIDE_SEEDS) {
      const instance = generate('interval_naming', { grade: 2, seed, atoms: [] });
      const music = instance.stimulus.music as { key_sig: string };
      if (music.key_sig.split('_')[0] === 'A') found = true;
    }
    expect(found).toBe(true);
  });

  test('key_signature_id reaches the grade-2-added A major key across seeds (atoms limited to C/A — see Bb/Eb note above)', () => {
    const atoms = ['key_sig:C_major', 'key_sig:A_major'];
    let found = false;
    for (const seed of WIDE_SEEDS) {
      const instance = generate('key_signature_id', { grade: 2, seed, atoms });
      if ((instance.answer.canonical as string).startsWith('A ')) found = true;
    }
    expect(found).toBe(true);
  });

  // Guards spellInKey (interval-naming.ts) against a 3-accidental key: A
  // major's three sharps (F#, C#, G#) must actually appear on the target
  // pitch, not be silently dropped — the risk D3 flags for major-key-shaped
  // spelling logic. Uses A major rather than Eb (see the Bb/Eb note above).
  test('interval_naming_stave_input in A major spells F/C/G targets with the sharp A major requires', () => {
    const sharps = keyAccidentals('A_major');
    let foundAMajor = false;
    let foundSharpTarget = false;
    for (const seed of WIDE_SEEDS) {
      const instance = generate('interval_naming_stave_input', { grade: 2, seed, atoms: [] });
      const music = instance.stimulus.music as { key_sig: string };
      const tonic = music.key_sig.split('_')[0];
      if (tonic !== 'A') continue;
      foundAMajor = true;

      assertValidatorClean(instance);

      const canonical = instance.answer.canonical as { pitch: string };
      const letter = canonical.pitch[0];
      const wantsSharp = sharps[letter] === 'sharp';
      if (wantsSharp) foundSharpTarget = true;
      expect(canonical.pitch.startsWith(`${letter}#`)).toBe(wantsSharp);
    }
    expect(foundAMajor).toBe(true);
    expect(foundSharpTarget).toBe(true);
  });
});
