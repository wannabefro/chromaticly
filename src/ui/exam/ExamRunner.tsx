// Grade-1 practice exam (302.2, design 3b/3c/3d). Assessment mode shifts register
// (never-violate rule 4): warm --exam-* paper, Source Serif 4 headings, and ZERO
// gamification — no hints, no streak, no per-item correct/incorrect feedback. The
// paper is answered silently (pick → Next), graded objectively at the end, and
// banded Pass/Merit/Distinction. All items are single-pick MCQ, so one warm option
// renderer + assembleOptions grading serves the whole paper.
//
// Notation still renders on the light --paper card even here (rule 1) via
// NotationCard — the exam register never inverts notation.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { buildExamPaper, tallyExam, type Band, type ExamResult, EXAM_BANDS } from '../../learn/exam';
import { assembleOptions, type Option } from '../grading';
import { NotationCard } from '../components/NotationCard';
import { Screen } from '../Screen';
import { examColors as x, shape, type } from '../theme';

type Phase = 'start' | 'paper' | 'results';

const BAND_LABEL: Record<Band, string> = {
  distinction: 'Distinction',
  merit: 'Merit',
  pass: 'Pass',
  below: 'Not yet passed',
};

function bandHue(band: Band): string {
  if (band === 'distinction') return x.bandDistinction;
  if (band === 'merit') return x.bandMerit;
  if (band === 'pass') return x.bandPass;
  return x.muted;
}

export interface ExamRunnerProps {
  grade: number;
  onExit: () => void;
  /** Deterministic paper for tests/E2E; the gate passes a varying seed on device. */
  paperSeed?: number;
}

export function ExamRunner({ grade, onExit, paperSeed = 0 }: ExamRunnerProps) {
  const paper = useMemo(() => buildExamPaper(paperSeed), [paperSeed]);
  const [phase, setPhase] = useState<Phase>('start');
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>(() => paper.questions.map(() => null));

  const optionsByQuestion = useMemo(
    () => paper.questions.map((q) => assembleOptions(q.instance)),
    [paper],
  );

  const result: ExamResult = useMemo(() => {
    const correct = paper.questions.map((_, i) => {
      const pick = picks[i];
      return pick != null && optionsByQuestion[i][pick]?.correct === true;
    });
    return tallyExam(paper, correct);
  }, [paper, picks, optionsByQuestion]);

  const passMark = Math.ceil(EXAM_BANDS.pass * paper.totalMarks);
  const meritMark = Math.ceil(EXAM_BANDS.merit * paper.totalMarks);
  const distMark = Math.ceil(EXAM_BANDS.distinction * paper.totalMarks);
  const bandLine = `Pass ${passMark} · Merit ${meritMark} · Distinction ${distMark}`;

  // ── Start (3b) ──────────────────────────────────────────────────────────────
  if (phase === 'start') {
    const sectionCounts = paper.sections.map((s) => ({
      title: s.title,
      count: paper.questions.filter((q) => q.section === s.strand).length,
    }));
    return (
      <Screen style={styles.screen} testID="exam-start">
        <ScrollView contentContainerStyle={styles.startBody}>
          <Text style={styles.overline}>Assessment mode</Text>
          <Text style={styles.h1}>Practice Exam Paper</Text>
          <Text style={styles.conditions}>Grade {grade} · exam conditions</Text>

          <View style={styles.statRow}>
            <Text style={styles.stat}>{paper.totalMarks} MARKS</Text>
            <Text style={styles.stat}>{paper.sections.length} SECTIONS</Text>
          </View>

          <View style={styles.card}>
            {sectionCounts.map((s, i) => (
              <View key={s.title} style={styles.sectionRow}>
                <Text style={styles.sectionName}>
                  {i + 1} · {s.title}
                </Text>
                <Text style={styles.sectionMarks}>{s.count}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.bandLine}>{bandLine}</Text>
          <Text style={styles.note}>No hints, no streaks, no timer pauses — just like exam day.</Text>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable testID="exam-begin" style={styles.primary} onPress={() => setPhase('paper')}>
            <Text style={styles.primaryLabel}>Begin exam</Text>
          </Pressable>
          <Pressable testID="exam-cancel" onPress={onExit} style={styles.ghost}>
            <Text style={styles.ghostLabel}>Not now</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // ── Results (3d) ─────────────────────────────────────────────────────────────
  if (phase === 'results') {
    return (
      <Screen style={styles.screen} testID="exam-results">
        <ScrollView contentContainerStyle={styles.startBody}>
          <Text style={styles.overline}>Grade {grade} Exam Paper · result</Text>
          <Text testID="exam-total" style={styles.total}>
            {result.total}
            <Text style={styles.totalOf}> / {result.totalMarks}</Text>
          </Text>
          <View style={[styles.bandChip, { backgroundColor: bandHue(result.band) }]}>
            <Text testID="exam-band" style={styles.bandChipLabel}>
              {BAND_LABEL[result.band]}
            </Text>
          </View>
          <Text style={styles.bandLine}>{bandLine}</Text>

          <View style={styles.card}>
            {result.sections.map((s) => {
              const weak = s.correct < Math.ceil(EXAM_BANDS.pass * s.total);
              return (
                <View key={s.strand} style={styles.sectionRow} testID={`exam-section-${s.strand}`}>
                  <Text style={styles.sectionName}>{s.title}</Text>
                  <Text style={[styles.sectionMarks, weak && styles.weak]}>
                    {s.correct}/{s.total}
                    {weak ? '  · revise' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable testID="exam-back-to-learn" style={styles.primary} onPress={onExit}>
            <Text style={styles.primaryLabel}>Back to Learn</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // ── In progress (3c) ─────────────────────────────────────────────────────────
  const q = paper.questions[index];
  const options = optionsByQuestion[index];
  const picked = picks[index];
  const isLast = index === paper.questions.length - 1;
  const music = q.instance.stimulus.music;

  const select = (i: number) => setPicks((prev) => prev.map((p, j) => (j === index ? i : p)));
  const next = () => {
    if (isLast) setPhase('results');
    else setIndex((i) => i + 1);
  };

  return (
    <Screen style={styles.screen} testID="exam-paper">
      <View style={styles.paperHeader}>
        <Text style={styles.sectionTag}>{q.sectionTitle}</Text>
        <Text style={styles.qCount}>
          Q {index + 1} / {paper.questions.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.paperBody}>
        <Text style={styles.prompt}>{q.instance.prompt}</Text>
        {music ? (
          <View testID="stimulus-music">
            <NotationCard music={music} />
          </View>
        ) : (
          q.instance.stimulus.text != null && <Text style={styles.stimulusText}>{q.instance.stimulus.text}</Text>
        )}

        <View style={styles.options}>
          {options.map((opt: Option, i: number) => {
            const selected = picked === i;
            return (
              <Pressable
                key={i}
                testID={`exam-option-${i}`}
                onPress={() => select(i)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                {opt.music ? (
                  <NotationCard music={opt.music} />
                ) : (
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{opt.label}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          testID="exam-next"
          disabled={picked == null}
          onPress={next}
          style={[styles.primary, picked == null && styles.primaryDisabled]}
        >
          <Text style={styles.primaryLabel}>{isLast ? 'Finish paper' : 'Next'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: x.bg },
  startBody: { padding: shape.spaceScreenX, gap: shape.spaceCard, paddingBottom: 32 },
  overline: {
    fontFamily: type.overline.fontFamily,
    fontSize: type.overline.fontSize,
    lineHeight: type.overline.lineHeight,
    letterSpacing: type.overline.letterSpacing,
    textTransform: type.overline.textTransform,
    color: x.faint,
  },
  h1: { fontFamily: type.examTitle.fontFamily, fontSize: type.examTitle.fontSize, lineHeight: type.examTitle.lineHeight, color: x.ink },
  conditions: { fontFamily: type.body.fontFamily, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, color: x.muted },
  statRow: { flexDirection: 'row', gap: shape.spaceCard },
  stat: { fontFamily: type.overline.fontFamily, fontSize: type.overline.fontSize, letterSpacing: type.overline.letterSpacing, color: x.accent },
  card: {
    backgroundColor: x.card,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: x.border,
    padding: shape.spaceCard,
    gap: 10,
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionName: { fontFamily: type.examPrompt.fontFamily, fontSize: 16, lineHeight: 21, color: x.ink },
  // Marks are numbers users scan, so they're mono (design/README.md).
  sectionMarks: { fontFamily: type.label.fontFamily, fontSize: type.body.fontSize, color: x.muted },
  weak: { color: x.accent },
  bandLine: { fontFamily: type.body.fontFamily, fontSize: type.body.fontSize, color: x.muted },
  note: { fontFamily: type.body.fontFamily, fontSize: type.body.fontSize, color: x.faint },
  footer: { padding: shape.spaceScreenX, gap: shape.spaceInline },
  primary: {
    backgroundColor: x.accent,
    borderRadius: shape.radiusButton,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: shape.tapMin,
    justifyContent: 'center',
  },
  primaryDisabled: { opacity: 0.4 },
  primaryLabel: { fontFamily: type.examPrompt.fontFamily, fontSize: 16, color: x.card },
  ghost: { paddingVertical: 12, alignItems: 'center' },
  ghostLabel: { fontFamily: type.body.fontFamily, fontSize: type.body.fontSize, color: x.muted },
  // results
  total: { fontFamily: type.examTitle.fontFamily, fontSize: 44, lineHeight: 48, color: x.ink },
  totalOf: { fontSize: 22, color: x.muted },
  bandChip: { alignSelf: 'flex-start', borderRadius: shape.radiusChip, paddingHorizontal: 14, paddingVertical: 6 },
  bandChipLabel: { fontFamily: type.examPrompt.fontFamily, fontSize: 16, color: x.card },
  // paper
  paperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: 4,
    paddingBottom: shape.spaceInline,
    borderBottomWidth: shape.borderW,
    borderBottomColor: x.border,
  },
  sectionTag: { fontFamily: type.examPrompt.fontFamily, fontSize: 16, color: x.ink },
  qCount: { fontFamily: type.overline.fontFamily, fontSize: type.overline.fontSize, letterSpacing: type.overline.letterSpacing, color: x.muted },
  paperBody: { padding: shape.spaceScreenX, gap: shape.spaceCard },
  prompt: { fontFamily: type.examPrompt.fontFamily, fontSize: type.examPrompt.fontSize, lineHeight: type.examPrompt.lineHeight, color: x.ink },
  stimulusText: { fontFamily: type.examTitle.fontFamily, fontSize: type.examTitle.fontSize, color: x.ink, textAlign: 'center' },
  options: { gap: shape.spaceInline },
  option: {
    backgroundColor: x.card,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: x.border,
    padding: shape.spaceCard,
    minHeight: shape.tapMin,
    justifyContent: 'center',
  },
  optionSelected: { borderColor: x.accent, backgroundColor: x.bg },
  optionLabel: { fontFamily: type.body.fontFamily, fontSize: 16, lineHeight: 21, color: x.ink },
  optionLabelSelected: { color: x.ink },
});
