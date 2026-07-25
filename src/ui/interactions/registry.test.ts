// U3/AD1: characterizes the registry as a drop-in replacement for the old
// isMcq boolean dispatch — the safety net for the hot exercise-render path.
// Scenario 1 (characterization) grades every live generator's instance, across
// a fixed seed set and every assembled option (not just the canonical pick),
// through both the old gradeMcq/gradeText and the new registry `spec.grade`,
// and asserts identical verdicts. All five live generators (note_naming,
// interval_naming, rhythm_sum, key_signature_id, term_meaning) currently emit
// `mcq` only — no generator emits `text_input` yet — so text_input parity is
// characterized against representative fixtures instead (mirroring
// ExerciseLoop.test.tsx's textInstance), covering the same gradeText code path.
//
// registry.tsx pulls in NotationCard (for correctAnswerView) -> MusicSurface ->
// react-native-webview, which has no native module in the jest environment —
// mocked here exactly as ExerciseLoop.test.tsx does.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return {
    WebView: React.forwardRef((_props: Record<string, unknown>, _ref: unknown) => null),
  };
});

import { generate } from '../../engine/generators';
import { atomsForTemplate } from '../../engine/generators/test-helpers';
import type { ExerciseInstance } from '../../engine/schema';
import { NotationCard } from '../components/NotationCard';
import { assembleOptions, gradeMcq, gradeStaveInput, gradeText, optionLabel } from '../grading';
import { INTERACTIONS, lookupInteraction } from './registry';

const MCQ_TEMPLATE_IDS = ['note_naming', 'interval_naming', 'rhythm_sum', 'key_signature_id', 'term_meaning'];
const SEEDS = Array.from({ length: 20 }, (_, i) => i);

describe('registry — mcq characterization (zero behavior change)', () => {
  test('every live generator instance grades identically through the registry as through gradeMcq, for every assembled option', () => {
    const mcqSpec = lookupInteraction('mcq');
    let comparisons = 0;

    for (const templateId of MCQ_TEMPLATE_IDS) {
      for (const seed of SEEDS) {
        const instance = generate(templateId, { grade: 1, seed, atoms: atomsForTemplate(templateId) });
        expect(instance.interaction.type).toBe('mcq');
        const options = assembleOptions(instance);

        options.forEach((option, index) => {
          const oldVerdict = gradeMcq(instance, option.value);
          const newVerdict = mcqSpec.grade(instance, index);
          expect(newVerdict).toBe(oldVerdict);
          comparisons += 1;
        });
      }
    }

    // Guard against a vacuous pass: 5 templates * 20 seeds * >=2 options each.
    expect(comparisons).toBeGreaterThan(200);
  });

  test('exactly one option per instance grades correct — the canonical pick', () => {
    const mcqSpec = lookupInteraction('mcq');
    for (const templateId of MCQ_TEMPLATE_IDS) {
      const instance = generate(templateId, { grade: 1, seed: 7, atoms: atomsForTemplate(templateId) });
      const options = assembleOptions(instance);
      const correctIndices = options.map((_, i) => i).filter((i) => mcqSpec.grade(instance, i));
      expect(correctIndices).toHaveLength(1);
      expect(options[correctIndices[0]].correct).toBe(true);
    }
  });
});

describe('registry — text_input characterization (zero behavior change)', () => {
  const textInstance: ExerciseInstance = {
    id: 'test-text-1',
    template_id: 'note_naming',
    grade: 1,
    strand: 'pitch',
    prompt: 'Name this note.',
    stimulus: { music: null, text: null },
    interaction: { type: 'text_input', config: {} },
    answer: { canonical: 'E flat', accepted_alternatives: ['Eb', 'E♭'] },
    distractors: [],
    hints: [],
    feedback: { correct: 'Nice!', incorrect: 'Not quite.' },
    srs_tags: ['pitch:test'],
    kb_version: 'test',
  };

  test.each(['E flat', 'e flat', 'Eb', 'eb', 'E♭', '  E flat  '])(
    'accepted input %j grades identically through the registry as through gradeText',
    (input) => {
      const spec = lookupInteraction('text_input');
      expect(spec.grade(textInstance, input)).toBe(gradeText(textInstance, input));
      expect(spec.grade(textInstance, input)).toBe(true);
    },
  );

  test.each(['F sharp', '', 'E flatt'])(
    'rejected input %j grades identically through the registry as through gradeText',
    (input) => {
      const spec = lookupInteraction('text_input');
      expect(spec.grade(textInstance, input)).toBe(gradeText(textInstance, input));
      expect(spec.grade(textInstance, input)).toBe(false);
    },
  );
});

describe('registry — lookupInteraction fails loud on unsupported types (AD1: never a silent Mcq fallback)', () => {
  test('throws a clear error for a schema-only-unsupported type', () => {
    expect(() => lookupInteraction('multi_select')).toThrow(/multi_select/);
  });

  test('throws for every schema-enum value with no registered entry', () => {
    const unsupported = ['multi_select', 'tap_placement', 'grid_fill'] as const;
    for (const type of unsupported) {
      expect(() => lookupInteraction(type)).toThrow();
    }
  });

  test('the registry is partial — only the built interaction types are registered', () => {
    expect(Object.keys(INTERACTIONS).sort()).toEqual([
      'drag_match',
      'find_the_bar',
      'flashcard',
      'mcq',
      'note_value_palette',
      'roman_numeral_boxes',
      'stave_input',
      'text_input',
      'transposition_input',
      'true_false',
      'voice_options',
    ]);
  });
});

describe('registry — stave_input (U8, interval_naming_stave_input)', () => {
  const staveInstance = generate('interval_naming_stave_input', { grade: 1, seed: 5, atoms: [] });

  test('emptyResponse resets to no placement', () => {
    expect(lookupInteraction('stave_input').emptyResponse(staveInstance)).toBeNull();
  });

  test('canCheck is false until a note is placed, true once one is', () => {
    const spec = lookupInteraction('stave_input');
    expect(spec.canCheck(null)).toBe(false);
    const canonical = staveInstance.answer.canonical as { pitch: string; dur: string };
    expect(spec.canCheck({ pitch: canonical.pitch, dur: canonical.dur })).toBe(true);
  });

  test('grade matches gradeStaveInput exactly (registry stays a thin dispatch, not a second grading rule)', () => {
    const spec = lookupInteraction('stave_input');
    const canonical = staveInstance.answer.canonical as { pitch: string; dur: string };
    const placement = { pitch: canonical.pitch, dur: canonical.dur };
    expect(spec.grade(staveInstance, placement)).toBe(gradeStaveInput(staveInstance, placement));
    expect(spec.grade(staveInstance, placement)).toBe(true);
    expect(spec.grade(staveInstance, { pitch: 'Z9', dur: canonical.dur })).toBe(false);
  });

  test('submits is true — stave_input uses the shared Check button', () => {
    expect(lookupInteraction('stave_input').submits).toBe(true);
  });

  test('correctAnswerView renders the target pitch and duration', () => {
    const canonical = staveInstance.answer.canonical as { pitch: string; dur: string };
    const view = lookupInteraction('stave_input').correctAnswerView(staveInstance);
    const rendered = JSON.stringify(view);
    expect(rendered).toContain(canonical.pitch);
    expect(rendered).toContain(canonical.dur);
  });
});

describe('registry — transposition_input (U6, octave_transposition)', () => {
  const transpositionInstance = generate('octave_transposition', { grade: 3, seed: 1, atoms: ['transpose:octave'] });

  test('emptyResponse sizes placements from per_item, locked empty until fix-mode', () => {
    const spec = lookupInteraction('transposition_input');
    const perItem = transpositionInstance.answer.per_item as unknown[];
    expect(spec.emptyResponse(transpositionInstance)).toEqual({
      placements: Array(perItem.length).fill(null),
      locked: [],
    });
  });

  test('canCheck is false until every slot is placed — checkLabel names how many remain', () => {
    const spec = lookupInteraction('transposition_input');
    const perItem = transpositionInstance.answer.per_item as { pitch: string }[];
    const empty = { placements: Array(perItem.length).fill(null), locked: [] };
    expect(spec.canCheck(empty)).toBe(false);
    expect(spec.checkLabel?.(transpositionInstance, empty)).toBe(`Check — ${perItem.length} notes left`);

    const full = { placements: perItem.map((p) => p.pitch), locked: [] };
    expect(spec.canCheck(full)).toBe(true);
    expect(spec.checkLabel?.(transpositionInstance, full)).toBe('Check');
  });

  test('grade requires every placement to match per_item exactly (no partial credit)', () => {
    const spec = lookupInteraction('transposition_input');
    const perItem = transpositionInstance.answer.per_item as { pitch: string }[];
    const allCorrect = { placements: perItem.map((p) => p.pitch), locked: [] };
    expect(spec.grade(transpositionInstance, allCorrect)).toBe(true);

    const oneWrong = { placements: perItem.map((p, i) => (i === 0 ? 'Z9' : p.pitch)), locked: [] };
    expect(spec.grade(transpositionInstance, oneWrong)).toBe(false);
  });

  test('submits is true — transposition_input uses the shared Check button', () => {
    expect(lookupInteraction('transposition_input').submits).toBe(true);
  });

  test('correctAnswerView renders every target pitch, in the answer clef (not the stimulus clef)', () => {
    const spec = lookupInteraction('transposition_input');
    const perItem = transpositionInstance.answer.per_item as { pitch: string }[];
    const view = spec.correctAnswerView(transpositionInstance) as { props: { music: { clef: string } } };
    const rendered = JSON.stringify(view);
    for (const { pitch } of perItem) expect(rendered).toContain(pitch);
    expect(view.props.music.clef).toBe(transpositionInstance.interaction.config.answerClef);
    expect(view.props.music.clef).not.toBe(transpositionInstance.stimulus.music.clef);
  });
});

describe('registry — drag_match (fyu.12, term ↔ meaning; design 5f)', () => {
  const dragInstance: ExerciseInstance = {
    id: 'drag-1',
    template_id: 'instrument_knowledge',
    grade: 4,
    strand: 'terms_signs',
    prompt: 'Match each direction to its meaning.',
    stimulus: { music: null, text: null },
    interaction: { type: 'drag_match', config: { left: ['arco', 'pizzicato'], right: ['plucked', 'with the bow'] } },
    answer: { canonical: { arco: 'with the bow', pizzicato: 'plucked' }, accepted_alternatives: [] },
    distractors: [],
    hints: [],
    feedback: { correct: 'c', incorrect: 'i' },
    srs_tags: ['direction:arco', 'direction:pizzicato'],
    kb_version: 'test',
  };

  test('emptyResponse seeds every left term to null, and nothing else', () => {
    expect(lookupInteraction('drag_match').emptyResponse(dragInstance)).toEqual({ arco: null, pizzicato: null });
  });

  test('canCheck is false until every term is paired; the reserved held-pick key never counts', () => {
    const spec = lookupInteraction('drag_match');
    expect(spec.canCheck({ arco: null, pizzicato: null })).toBe(false);
    expect(spec.canCheck({ arco: 'with the bow', pizzicato: null })).toBe(false);
    // A held pool pick (reserved '' key) is not a term — a fully-paired set with one still checks true.
    expect(spec.canCheck({ arco: 'with the bow', pizzicato: 'plucked', '': 'x' })).toBe(true);
    expect(spec.canCheck({ arco: 'with the bow', pizzicato: 'plucked' })).toBe(true);
  });

  test('grade is true only when every pair matches the canonical map — one wrong pair fails the whole item', () => {
    const spec = lookupInteraction('drag_match');
    expect(spec.grade(dragInstance, { arco: 'with the bow', pizzicato: 'plucked' })).toBe(true);
    expect(spec.grade(dragInstance, { arco: 'plucked', pizzicato: 'with the bow' })).toBe(false);
    expect(spec.grade(dragInstance, { arco: 'with the bow', pizzicato: null })).toBe(false);
  });

  test('submits is true — drag_match uses the shared Check button', () => {
    expect(lookupInteraction('drag_match').submits).toBe(true);
  });

  test('correctAnswerView lists every term with its canonical meaning', () => {
    const view = lookupInteraction('drag_match').correctAnswerView(dragInstance);
    const rendered = JSON.stringify(view);
    expect(rendered).toContain('arco — with the bow');
    expect(rendered).toContain('pizzicato — plucked');
  });
});

describe('registry — roman_numeral_boxes (fyu.10, chord_recognition)', () => {
  const chordAtoms = ['chord:I', 'chord:IV', 'chord:V'];
  const chordInstance = generate('chord_recognition', { grade: 4, seed: 3, atoms: chordAtoms });

  test('emptyResponse resets to no numeral picked', () => {
    expect(lookupInteraction('roman_numeral_boxes').emptyResponse(chordInstance)).toBeNull();
  });

  test('canCheck is false until a numeral is picked, true once one is', () => {
    const spec = lookupInteraction('roman_numeral_boxes');
    expect(spec.canCheck(null)).toBe(false);
    expect(spec.canCheck('I')).toBe(true);
  });

  test('grade matches gradeMcq — the canonical numeral is correct, any other numeral incorrect', () => {
    const spec = lookupInteraction('roman_numeral_boxes');
    const canonical = chordInstance.answer.canonical as string;
    expect(spec.grade(chordInstance, canonical)).toBe(gradeMcq(chordInstance, canonical));
    expect(spec.grade(chordInstance, canonical)).toBe(true);
    const wrong = ['I', 'IV', 'V'].find((n) => n !== canonical)!;
    expect(spec.grade(chordInstance, wrong)).toBe(false);
  });

  test('submits is true — roman_numeral_boxes uses the shared Check button', () => {
    expect(lookupInteraction('roman_numeral_boxes').submits).toBe(true);
  });

  // Rule 1/2: the missed chord is revealed on paper (a NotationCard, which carries
  // play), captioned with its numeral and spelled triad — sourced from config.triads.
  test('correctAnswerView renders the stimulus chord on paper, captioned with the numeral and its spelled triad', () => {
    const spec = lookupInteraction('roman_numeral_boxes');
    const canonical = chordInstance.answer.canonical as string;
    const triad = (chordInstance.interaction.config.triads as Record<string, string[]>)[canonical];
    const view = spec.correctAnswerView(chordInstance) as { type: unknown; props: { music: unknown; caption: string; play?: boolean } };
    expect(view.type).toBe(NotationCard);
    expect(view.props.music).toEqual(chordInstance.stimulus.music);
    expect(view.props.caption).toContain(canonical);
    // Each spelled letter (octave stripped) appears in the caption.
    for (const pitch of triad) {
      expect(view.props.caption).toContain(/^([A-G][#b]{0,2})/.exec(pitch)![1]);
    }
    expect(view.props.play).not.toBe(false);
  });
});

describe('registry — flashcard (U7, term_meaning_flashcard)', () => {
  const flashcardInstance = generate('term_meaning_flashcard', { grade: 1, seed: 3, atoms: [] });

  test('emptyResponse resets to unrevealed with no grade picked', () => {
    const spec = lookupInteraction('flashcard');
    expect(spec.emptyResponse(flashcardInstance)).toEqual({ revealed: false, picked: null });
  });

  test('grade always returns null — self-graded, no correct/incorrect verdict (AD1)', () => {
    const spec = lookupInteraction('flashcard');
    expect(spec.grade(flashcardInstance, { revealed: false, picked: null })).toBeNull();
    expect(spec.grade(flashcardInstance, { revealed: true, picked: 'good' })).toBeNull();
  });

  test('submits is false — flashcard owns its own submission (the 4 grade buttons), not the shared Check button', () => {
    expect(lookupInteraction('flashcard').submits).toBe(false);
  });

  test('correctAnswerView renders the term\'s meaning (used only if ever reached — graded stays null in practice)', () => {
    const view = lookupInteraction('flashcard').correctAnswerView(flashcardInstance);
    const canonical = flashcardInstance.answer.canonical as { value: string };
    expect(JSON.stringify(view)).toContain(canonical.value);
  });
});

describe('registry — true_false (U5, bar_validity)', () => {
  const barValidityInstance = generate('bar_validity', { grade: 1, seed: 4, atoms: [] });

  test('emptyResponse resets to a null-per-bar array sized from the bar-identity metadata', () => {
    const spec = lookupInteraction('true_false');
    const barCount = (barValidityInstance.interaction.config.bars as unknown[]).length;
    const response = spec.emptyResponse(barValidityInstance) as (boolean | null)[];
    expect(response).toEqual(Array(barCount).fill(null));
  });

  test('canCheck is false until every bar is answered, true once all are', () => {
    const spec = lookupInteraction('true_false');
    const barCount = (barValidityInstance.interaction.config.bars as unknown[]).length;
    expect(spec.canCheck(Array(barCount).fill(null))).toBe(false);
    expect(spec.canCheck([true, ...Array(barCount - 1).fill(null)])).toBe(false);
    expect(spec.canCheck(Array(barCount).fill(true))).toBe(true);
  });

  test('grade matches every per-bar verdict exactly — one wrong bar grades the whole item incorrect', () => {
    const spec = lookupInteraction('true_false');
    const perItem = barValidityInstance.answer.per_item as boolean[];
    expect(spec.grade(barValidityInstance, perItem)).toBe(true);

    const oneWrong = perItem.map((v, i) => (i === 0 ? !v : v));
    expect(spec.grade(barValidityInstance, oneWrong)).toBe(false);
  });

  test('submits is true — true_false uses the shared Check button', () => {
    expect(lookupInteraction('true_false').submits).toBe(true);
  });

  test('correctAnswerView renders every bar\'s correct verdict', () => {
    const view = lookupInteraction('true_false').correctAnswerView(barValidityInstance);
    const perItem = barValidityInstance.answer.per_item as boolean[];
    const rendered = JSON.stringify(view);
    perItem.forEach((verdict, i) => {
      expect(rendered).toContain(`Bar ${i + 1} ${verdict ? '✓' : '✗'}`);
    });
  });
});

describe('registry — protocol shape', () => {
  test('grade returns a boolean for mcq and text_input (the self-graded null path is exercised later, by flashcard)', () => {
    const mcqInstance = generate('note_naming', { grade: 1, seed: 1, atoms: ['note_read:treble:C4', 'note_read:treble:E4', 'note_read:treble:G4'] });
    expect(typeof lookupInteraction('mcq').grade(mcqInstance, 0)).toBe('boolean');

    const textInstance: ExerciseInstance = { ...mcqInstance, interaction: { type: 'text_input', config: {} } };
    expect(typeof lookupInteraction('text_input').grade(textInstance, 'anything')).toBe('boolean');
  });

  test('submits is true for both mcq and text_input — both use the shared Check button', () => {
    expect(lookupInteraction('mcq').submits).toBe(true);
    expect(lookupInteraction('text_input').submits).toBe(true);
  });

  test('canCheck: mcq requires a non-null selection, text_input requires non-empty trimmed text', () => {
    expect(lookupInteraction('mcq').canCheck(null)).toBe(false);
    expect(lookupInteraction('mcq').canCheck(0)).toBe(true);
    expect(lookupInteraction('text_input').canCheck('')).toBe(false);
    expect(lookupInteraction('text_input').canCheck('   ')).toBe(false);
    expect(lookupInteraction('text_input').canCheck('a')).toBe(true);
  });

  test('emptyResponse: mcq resets to null, text_input resets to an empty string', () => {
    const instance = generate('note_naming', { grade: 1, seed: 1, atoms: ['note_read:treble:C4', 'note_read:treble:E4', 'note_read:treble:G4'] });
    expect(lookupInteraction('mcq').emptyResponse(instance)).toBeNull();
    expect(lookupInteraction('text_input').emptyResponse(instance)).toBe('');
  });

  // Design 4c: only find-the-bar wires the score-tap protocol — a tap becomes the
  // response and the response tints that bar. Other interactions opt out (no notation
  // answer), so the loop leaves their score untouched.
  test('find_the_bar implements the score-tap protocol; mcq/text_input do not', () => {
    const ftb = lookupInteraction('find_the_bar');
    expect(ftb.onSurfaceTap?.(3, null)).toBe(3); // a tap on bar 3 IS the answer
    expect(ftb.surfaceHighlight?.(2)).toBe(2); // and the picked bar is the tint
    expect(ftb.surfaceHighlight?.(null)).toBeNull(); // nothing picked, nothing tinted

    expect(lookupInteraction('mcq').onSurfaceTap).toBeUndefined();
    expect(lookupInteraction('mcq').surfaceHighlight).toBeUndefined();
    expect(lookupInteraction('text_input').onSurfaceTap).toBeUndefined();
  });
});

describe('registry — correctAnswerView', () => {
  test('text_input renders the canonical answer string', () => {
    const instance: ExerciseInstance = {
      id: 'x',
      template_id: 'note_naming',
      grade: 1,
      strand: 'pitch',
      prompt: 'p',
      stimulus: { music: null, text: null },
      interaction: { type: 'text_input', config: {} },
      answer: { canonical: 'E flat', accepted_alternatives: [] },
      distractors: [],
      hints: [],
      feedback: { correct: 'c', incorrect: 'i' },
      srs_tags: [],
      kb_version: 'test',
    };
    const view = lookupInteraction('text_input').correctAnswerView(instance) as { props?: { children?: unknown } };
    expect(JSON.stringify(view)).toContain('E flat');
  });

  test('mcq renders the correct option (the canonical answer\'s label)', () => {
    const instance = generate('key_signature_id', { grade: 1, seed: 3, atoms: atomsForTemplate('key_signature_id') });
    const options = assembleOptions(instance);
    const correctOption = options.find((o) => o.correct)!;
    const view = lookupInteraction('mcq').correctAnswerView(instance);
    expect(JSON.stringify(view)).toContain(correctOption.label);
  });

  // U4/AD5/F9: a notation-answer MCQ's FeedbackSheet must render the correct
  // OPTION's stave, not the stimulus music — they can diverge for a future
  // generator whose stimulus differs from its options (unlike key_signature_id,
  // where they happen to coincide, so a stimulus-music regression would slip
  // through unnoticed without this option-level assertion).
  test('a notation-answer MCQ (key_signature_id) renders the correct option\'s music, sourced from its render payload', () => {
    for (let seed = 0; seed < 10; seed++) {
      const instance = generate('key_signature_id', { grade: 1, seed, atoms: atomsForTemplate('key_signature_id') });
      const correctOption = assembleOptions(instance).find((o) => o.correct)!;
      expect(correctOption.music).toBeDefined();

      const view = lookupInteraction('mcq').correctAnswerView(instance) as {
        props: { music: unknown; caption: string };
      };
      expect(view.props.music).toEqual(correctOption.music);
      expect(view.props.caption).toBe(correctOption.value);
    }
  });

  // Rule 2/9: play is present outside options — the FeedbackSheet correct-answer
  // notation is not itself an AnswerOption, so it must not be play-disabled.
  test('the notation-answer correct-answer view carries play (unlike the play-disabled option)', () => {
    const instance = generate('key_signature_id', { grade: 1, seed: 3, atoms: atomsForTemplate('key_signature_id') });
    const view = lookupInteraction('mcq').correctAnswerView(instance) as { props: { play?: boolean } };
    expect(view.props.play).not.toBe(false);
  });
});

// D8: scale_construction (a spot-the-error mcq) sets interaction.config.answer_music
// to the TRUE scale — the stimulus is, by construction, the corrupted one. This is
// the only live template that sets the key; every other template's config omits it.
const SCALE_ATOMS = ['scale:A_minor_harmonic', 'scale:E_minor_harmonic', 'scale:D_minor_harmonic'];

describe('registry — answer_music affordance (U5/D8)', () => {
  test('an mcq instance WITH answer_music renders answer-notation from answer_music, not stimulus.music (the stimulus is the corrupted scale)', () => {
    for (let seed = 0; seed < 10; seed++) {
      const instance = generate('scale_construction', { grade: 2, seed, atoms: SCALE_ATOMS });
      const answerMusic = instance.interaction.config.answer_music;
      expect(answerMusic).toBeDefined();
      // The corruption rule guarantees the stimulus differs from the true scale.
      expect(instance.stimulus.music).not.toEqual(answerMusic);

      const view = lookupInteraction('mcq').correctAnswerView(instance) as {
        props: { music: unknown; caption: string; testID: string };
      };
      expect(view.props.testID).toBe('answer-notation');
      expect(view.props.music).toEqual(answerMusic);
      expect(view.props.music).not.toEqual(instance.stimulus.music);
      // Caption stays the canonical label (e.g. "2nd note"), not blanked out.
      expect(view.props.caption).toBe(optionLabel(instance.answer.canonical));
    }
  });

  test('the answer_music path renders inside a NotationCard — paper + play come from the component contract (rules 1/2)', () => {
    const instance = generate('scale_construction', { grade: 2, seed: 0, atoms: SCALE_ATOMS });
    const view = lookupInteraction('mcq').correctAnswerView(instance) as {
      type: unknown;
      props: { play?: boolean };
    };
    expect(view.type).toBe(NotationCard);
    expect(view.props.play).not.toBe(false);
  });

  // Characterization (additive-only guard): no existing template sets answer_music,
  // so their feedback rendering must be byte-identical to pre-U5 behavior.
  describe('characterization: existing templates are unchanged', () => {
    test('key_signature_id (option_music-shaped) still renders the correct OPTION\'s stave, ignoring the (absent) answer_music branch', () => {
      for (let seed = 0; seed < 10; seed++) {
        const instance = generate('key_signature_id', { grade: 1, seed, atoms: atomsForTemplate('key_signature_id') });
        expect(instance.interaction.config?.answer_music).toBeUndefined();
        const correctOption = assembleOptions(instance).find((o) => o.correct)!;
        const view = lookupInteraction('mcq').correctAnswerView(instance) as { props: { music: unknown; caption: string } };
        expect(view.props.music).toEqual(correctOption.music);
        expect(view.props.caption).toBe(correctOption.value);
      }
    });

    test('a plain mcq (no option_music, no answer_music) still falls through to stimulus.music unchanged', () => {
      const instance = generate('note_naming', { grade: 1, seed: 2, atoms: atomsForTemplate('note_naming') });
      expect(instance.interaction.config?.answer_music).toBeUndefined();
      const view = lookupInteraction('mcq').correctAnswerView(instance) as { props: { music: unknown } };
      expect(view.props.music).toEqual(instance.stimulus.music);
    });
  });
});
