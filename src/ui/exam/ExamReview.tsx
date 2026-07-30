// Post-results review of a graded paper (design 8b, entered from 3d's "Review paper").
//
// The mirror image of 8a: there, nothing may be revealed; here, everything is. The
// paper is graded and done, so correctness is visible everywhere — a green/red strip
// across the whole paper, the learner's answer marked against the right one, and per-
// question marks. Assessment mode still applies to the REGISTER (warm paper, serif,
// no XP or celebration) — showing a learner their own marked script is not
// gamification, it is the point of sitting the paper.
//
// Wrong answers reuse the item's own misconception copy (never-violate rule 5: name
// the misconception, show the rendered correct answer) rather than a second
// explanation written for the exam. The options themselves are mini play-less staves
// (rule 9), the same as in the exercise loop — play belongs to the stimulus above them.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ExamPaper } from '../../learn/exam';
import { NotationCard } from '../components/NotationCard';
import { StaticNotation } from '../components/StaticNotation';
import type { Option } from '../grading';
import { Screen } from '../Screen';
import { colors, examColors as x, shape, type } from '../theme';

export interface ExamReviewProps {
  paper: ExamPaper;
  /** The option index the learner picked per question; null where left blank. */
  picks: readonly (number | null)[];
  optionsByQuestion: readonly Option[][];
  /** Per question: did they get the mark? */
  correct: readonly boolean[];
  total: number;
  bandLabel: string;
  onClose: () => void;
  /** "revise <strand> →" — takes the learner back to the material. */
  onRevise: (strand: string) => void;
}

export function ExamReview({
  paper,
  picks,
  optionsByQuestion,
  correct,
  total,
  bandLabel,
  onClose,
  onRevise,
}: ExamReviewProps) {
  const [index, setIndex] = useState(() => {
    const firstWrong = correct.findIndex((c) => !c);
    return firstWrong === -1 ? 0 : firstWrong;
  });

  const q = paper.questions[index];
  const options = optionsByQuestion[index];
  const picked = picks[index];
  const got = correct[index];

  // Skips the ones they got right — with 34 correct answers in a 41-mark paper, the
  // only rows worth walking are the ones that cost a mark.
  const nextWrong = correct.findIndex((c, i) => i > index && !c);

  return (
    <Screen style={styles.screen} testID="exam-marked">
      <View style={styles.head}>
        <Pressable testID="exam-review-close" onPress={onClose} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Reviewing your paper</Text>
          <Text testID="exam-review-summary" style={styles.summary}>
            {total}/{paper.totalMarks} · {bandLabel} · graded
          </Text>
        </View>
      </View>

      {/* The whole paper at a glance — every question, right or wrong. */}
      <View style={styles.strip} testID="exam-review-strip">
        {paper.questions.map((_, i) => (
          <Pressable
            key={i}
            testID={`exam-review-q-${i}`}
            onPress={() => setIndex(i)}
            style={[
              styles.stripCell,
              correct[i] ? styles.stripCorrect : styles.stripWrong,
              i === index && styles.stripCurrent,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.qHead}>
          <Text style={styles.section}>{q.sectionTitle}</Text>
          <Text testID="exam-review-mark" style={styles.mark}>
            {got ? 1 : 0}/1 mark
          </Text>
        </View>
        <Text style={styles.counter}>
          Q{index + 1} / {paper.questions.length}
        </Text>

        <Text style={styles.prompt}>{q.instance.prompt}</Text>
        {q.instance.stimulus.music && <NotationCard music={q.instance.stimulus.music} />}

        <View style={styles.options}>
          {options.map((opt, i) => {
            const isPick = picked === i;
            const marker = opt.correct ? '✓' : isPick ? '×' : ' ';
            const note = opt.correct ? 'correct' : isPick ? 'your answer' : '';

            return (
              <View
                key={i}
                testID={`exam-review-option-${i}`}
                style={[styles.option, opt.correct && styles.optionCorrect, isPick && !opt.correct && styles.optionWrong]}
              >
                <Text style={[styles.marker, opt.correct && styles.markerCorrect, isPick && !opt.correct && styles.markerWrong]}>
                  {marker}
                </Text>
                <View style={styles.optionBody}>
                  {/* An option's notation is a mini play-less stave, exactly as in the
                      exercise loop (AnswerOption -> StaticNotation, rule 9: play is
                      omitted INSIDE an option; it belongs to the stimulus and the
                      feedback sheet). This used to be a full NotationCard, and three
                      of them pushed the misconception copy — the whole point of the
                      marked script — a screen and a half below the fold. */}
                  {opt.music ? <StaticNotation music={opt.music} /> : <Text style={styles.optionLabel}>{opt.label}</Text>}
                  {note !== '' && <Text style={styles.optionNote}>{note}</Text>}
                </View>
              </View>
            );
          })}
        </View>

        {!got && (
          <View style={styles.why}>
            <Text testID="exam-review-why" style={styles.whyText}>
              {picked == null ? 'You left this one blank.' : q.instance.feedback.incorrect}
            </Text>
            <Pressable testID="exam-review-revise" onPress={() => onRevise(q.section)}>
              <Text style={styles.revise}>revise {q.sectionTitle} →</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          testID="exam-review-prev"
          disabled={index === 0}
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
          style={[styles.ghostButton, index === 0 && styles.disabled]}
        >
          <Text style={styles.ghostLabel}>‹ Previous</Text>
        </Pressable>
        <Pressable
          testID="exam-review-next-wrong"
          disabled={nextWrong === -1}
          onPress={() => nextWrong !== -1 && setIndex(nextWrong)}
          style={[styles.primary, nextWrong === -1 && styles.disabled]}
        >
          <Text style={styles.primaryLabel}>Next wrong ›</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: x.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceInline, paddingHorizontal: shape.spaceScreenX, paddingTop: 4 },
  back: { fontFamily: type.label.fontFamily, fontSize: 22, color: x.muted },
  title: { fontFamily: type.examPrompt.fontFamily, fontSize: 16, color: x.ink },
  summary: { fontFamily: type.label.fontFamily, fontSize: 12, color: x.muted },

  strip: { flexDirection: 'row', gap: 3, paddingHorizontal: shape.spaceScreenX, paddingVertical: shape.spaceInline },
  stripCell: { flex: 1, height: 6, borderRadius: shape.radiusChip },
  // Green/red, not two exam tans: the strip's whole job is telling right from wrong at
  // a glance, and the warm palette's bands are too close together to do that.
  stripCorrect: { backgroundColor: colors.correct },
  stripWrong: { backgroundColor: colors.incorrect },
  stripCurrent: { height: 10 },

  body: { padding: shape.spaceScreenX, gap: shape.spaceCard, paddingBottom: 24 },
  qHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  section: { fontFamily: type.examPrompt.fontFamily, fontSize: 15, color: x.ink },
  mark: { fontFamily: type.label.fontFamily, fontSize: 12, color: x.muted },
  counter: { fontFamily: type.label.fontFamily, fontSize: 11, color: x.faint },
  prompt: { fontFamily: type.examPrompt.fontFamily, fontSize: type.examPrompt.fontSize, lineHeight: type.examPrompt.lineHeight, color: x.ink },

  options: { gap: shape.spaceInline },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    backgroundColor: x.card,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: x.border,
    padding: shape.spaceCard,
  },
  optionCorrect: { borderColor: colors.correct },
  optionWrong: { borderColor: x.accent },
  optionBody: { flex: 1, gap: 4 },
  optionLabel: { fontFamily: type.body.fontFamily, fontSize: 16, color: x.ink },
  optionNote: { fontFamily: type.label.fontFamily, fontSize: 11, color: x.faint },
  marker: { fontFamily: type.label.fontFamily, fontSize: 15, color: x.faint, width: 14 },
  markerCorrect: { color: colors.correct },
  markerWrong: { color: x.accent },

  why: {
    gap: shape.spaceInline,
    backgroundColor: x.card,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: x.border,
    padding: shape.spaceCard,
  },
  whyText: { fontFamily: type.body.fontFamily, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, color: x.ink },
  revise: { fontFamily: type.label.fontFamily, fontSize: 12, color: x.accent },

  footer: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceInline, padding: shape.spaceScreenX },
  ghostButton: { paddingVertical: 14, paddingHorizontal: 12 },
  ghostLabel: { fontFamily: type.body.fontFamily, fontSize: type.body.fontSize, color: x.muted },
  primary: {
    flex: 1,
    backgroundColor: x.accent,
    borderRadius: shape.radiusButton,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: shape.tapMin,
  },
  primaryLabel: { fontFamily: type.examPrompt.fontFamily, fontSize: 16, color: x.card },
  disabled: { opacity: 0.4 },
});
