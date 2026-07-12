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
import type { ExerciseInstance } from '../../engine/schema';
import { assembleOptions, gradeMcq, gradeText } from '../grading';
import { INTERACTIONS, lookupInteraction } from './registry';

const MCQ_TEMPLATE_IDS = ['note_naming', 'interval_naming', 'rhythm_sum', 'key_signature_id', 'term_meaning'];
const SEEDS = Array.from({ length: 20 }, (_, i) => i);

describe('registry — mcq characterization (zero behavior change)', () => {
  test('every live generator instance grades identically through the registry as through gradeMcq, for every assembled option', () => {
    const mcqSpec = lookupInteraction('mcq');
    let comparisons = 0;

    for (const templateId of MCQ_TEMPLATE_IDS) {
      for (const seed of SEEDS) {
        const instance = generate(templateId, { grade: 1, seed });
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
      const instance = generate(templateId, { grade: 1, seed: 7 });
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
    expect(() => lookupInteraction('drag_match')).toThrow(/drag_match/);
  });

  test('throws for every schema-enum value with no registered entry', () => {
    const unsupported = ['multi_select', 'stave_input', 'tap_placement', 'grid_fill', 'roman_numeral_boxes'] as const;
    for (const type of unsupported) {
      expect(() => lookupInteraction(type)).toThrow();
    }
  });

  test('the registry is partial — only mcq, text_input, and true_false are registered', () => {
    expect(Object.keys(INTERACTIONS).sort()).toEqual(['mcq', 'text_input', 'true_false']);
  });
});

describe('registry — true_false (U5, bar_validity)', () => {
  const barValidityInstance = generate('bar_validity', { grade: 1, seed: 4 });

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
    const mcqInstance = generate('note_naming', { grade: 1, seed: 1 });
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
    const instance = generate('note_naming', { grade: 1, seed: 1 });
    expect(lookupInteraction('mcq').emptyResponse(instance)).toBeNull();
    expect(lookupInteraction('text_input').emptyResponse(instance)).toBe('');
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
    const instance = generate('key_signature_id', { grade: 1, seed: 3 });
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
      const instance = generate('key_signature_id', { grade: 1, seed });
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
    const instance = generate('key_signature_id', { grade: 1, seed: 3 });
    const view = lookupInteraction('mcq').correctAnswerView(instance) as { props: { play?: boolean } };
    expect(view.props.play).not.toBe(false);
  });
});
