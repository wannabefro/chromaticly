// Self-graded flashcard interaction (U7, design 2g front / 2h revealed): tap the
// card to reveal the term's meaning + an optional notated exemplar, then pick
// Again/Hard/Good/Easy. Self-graded (the registry spec's `grade()` returns null)
// — it owns its own submission via `onSelfGrade` rather than the shared Check
// button/FeedbackSheet, which the loop never renders for this type. The interval
// sub-label under each grade button is a live PREVIEW from `reviewSrsGraded`
// against the atom's current SRS state, in the engine's tick units — not the
// design mock's calendar-day labels (the engine is tick-based, not wall-clock;
// see the filed bd issue).

import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProgressContext } from '../../learn/ProgressContext';
import { initialSrs, reviewSrsGraded, type SrsGrade } from '../../learn/srs';
import { MusicSurface, type MusicSurfaceHandle } from '../../music-surface/MusicSurface';
import type { Music } from '../../music/types';
import { NotationCard } from '../components/NotationCard';
import { colors, shape, strandDef, type as typo } from '../theme';
import type { InteractionComponentProps } from './types';

export interface FlashcardResponse {
  revealed: boolean;
  picked: SrsGrade | null;
}

interface TermAnswer {
  value: string;
  category: string;
}

const GRADES: SrsGrade[] = ['again', 'hard', 'good', 'easy'];
const GRADE_LABEL: Record<SrsGrade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };

// ~12% tint, built from the theme hue at runtime (never a literal hex — mirrors
// AnswerOption's TINT_ALPHA convention).
const TINT_ALPHA = '1F';
// No dedicated "info-blue" semantic token exists yet (tokens.ts only has
// correct/incorrect/hint). The chords strand hue is the closest blue in the
// token set — and the one the 2g/2h mock's "Easy" colour visually matches.
const EASY_HUE = strandDef('chords').hue;

const GRADE_COLOR: Record<SrsGrade, { text: string; border: string; background: string }> = {
  again: { text: colors.incorrect, border: colors.incorrect, background: colors.incorrectSurface },
  hard: { text: colors.hint, border: colors.hint, background: colors.hintSurface },
  good: { text: colors.correct, border: colors.correct, background: colors.correctSurface },
  easy: { text: EASY_HUE, border: EASY_HUE, background: `${EASY_HUE}${TINT_ALPHA}` },
};

/** `now=0` is a safe stand-in for a PREVIEW: reviewSrsGraded's resulting
 *  interval (nextDue - now) never depends on `now`'s actual value, only on the
 *  current ease/box — so nextDue at now=0 IS the interval, in ticks. */
function previewTicks(currentSrs: ReturnType<typeof initialSrs>, grade: SrsGrade): number {
  return reviewSrsGraded(currentSrs, grade, 0).nextDue;
}

function formatInterval(ticks: number): string {
  if (ticks <= 0) return 'now';
  return `${ticks} tick${ticks === 1 ? '' : 's'}`;
}

export function Flashcard({ instance, response, strand, onResponseChange, onSelfGrade }: InteractionComponentProps<FlashcardResponse>) {
  const { store } = useProgressContext();
  const previewSurfaceRef = useRef<MusicSurfaceHandle>(null);

  const atom = instance.srs_tags[0] ?? null;
  const currentSrs = atom && store ? store.getAtom(atom).srs : initialSrs();

  const term = (instance.interaction.config?.term as string | undefined) ?? '';
  const answer = instance.answer.canonical as TermAnswer;
  const category = ((instance.interaction.config?.category as string | undefined) ?? answer.category).replace('_', ' ');
  const exemplar = instance.interaction.config?.exemplar as Music | undefined;
  const hue = strandDef(strand).hue;

  const { revealed, picked } = response;
  const gradable = revealed && picked === null;

  const handleGrade = (grade: SrsGrade) => {
    if (!gradable) return;
    onResponseChange({ revealed: true, picked: grade });
    onSelfGrade?.(grade);
  };

  return (
    <View style={styles.container} testID="flashcard">
      {exemplar && (
        <View style={styles.hiddenSurface} pointerEvents="none">
          <MusicSurface ref={previewSurfaceRef} music={exemplar} height={1} />
        </View>
      )}

      <Pressable
        testID="flashcard-card"
        disabled={revealed}
        onPress={() => onResponseChange({ revealed: true, picked: null })}
        style={styles.card}
      >
        <View style={styles.categoryRow}>
          <View style={[styles.categoryDot, { backgroundColor: hue }]} />
          <Text style={[styles.categoryLabel, { color: hue }]}>{category}</Text>
        </View>

        {revealed ? (
          <View style={styles.revealedBody}>
            <Text style={[styles.term, styles.termRevealed, { color: hue }]}>{term}</Text>
            <View style={[styles.divider, { backgroundColor: hue }]} />
            <Text style={styles.meaning}>{answer.value}</Text>
            {exemplar && <NotationCard music={exemplar} testID="flashcard-exemplar" />}
          </View>
        ) : (
          <View style={styles.frontBody}>
            <Text style={styles.term}>{term}</Text>
            <Text style={styles.caption}>What does this term mean?</Text>
            {exemplar && (
              <Pressable
                testID="flashcard-preview-play"
                style={styles.previewPlay}
                onPress={() => previewSurfaceRef.current?.play()}
              >
                <Text style={[styles.previewPlayLabel, { color: hue }]}>hear it played</Text>
              </Pressable>
            )}
            <Text style={[styles.tapHint, { color: hue }]}>tap to reveal</Text>
          </View>
        )}
      </Pressable>

      <Text style={styles.footerCaption}>{revealed ? 'How well did you know it?' : 'tap the card to reveal · then grade'}</Text>
      <View style={styles.gradeRow}>
        {GRADES.map((grade) => {
          const c = GRADE_COLOR[grade];
          const disabled = !gradable;
          return (
            <Pressable
              key={grade}
              testID={`grade-${grade}`}
              disabled={disabled}
              onPress={() => handleGrade(grade)}
              style={[
                styles.gradeButton,
                { borderColor: c.border, backgroundColor: c.background },
                disabled && styles.gradeButtonDisabled,
              ]}
            >
              <Text style={[styles.gradeLabel, { color: c.text }]}>{GRADE_LABEL[grade]}</Text>
              <Text testID={`grade-${grade}-interval`} style={[styles.gradeInterval, { color: c.text }]}>
                {formatInterval(previewTicks(currentSrs, grade))}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: shape.spaceInline },
  hiddenSurface: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  card: {
    borderRadius: shape.radiusCardLg,
    borderWidth: shape.borderW,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
    padding: shape.spaceCard,
    minHeight: 220,
    justifyContent: 'space-between',
  },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryDot: { width: 8, height: 8, borderRadius: shape.radiusSwatch },
  categoryLabel: { ...typo.overline },
  frontBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: shape.spaceInline },
  revealedBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  term: { ...typo.hero, color: colors.text, textAlign: 'center' },
  termRevealed: { ...typo.cardTitle },
  divider: { width: 40, height: 1 },
  meaning: { ...typo.title, color: colors.text, textAlign: 'center' },
  caption: { ...typo.body, color: colors.textMuted },
  previewPlay: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewPlayLabel: { ...typo.label },
  tapHint: { ...typo.label, textAlign: 'center' },
  footerCaption: { ...typo.label, color: colors.textGhost, textAlign: 'center' },
  gradeRow: { flexDirection: 'row', gap: 9 },
  gradeButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: shape.radiusButton,
    borderWidth: shape.borderWActive,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  gradeButtonDisabled: { opacity: 0.35 },
  gradeLabel: { ...typo.option },
  gradeInterval: { ...typo.label, fontSize: 9 },
});
