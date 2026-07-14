// Grade-1 practice exam (302.2, design 3b/3c/3d). Assessment mode shifts register
// (never-violate rule 4): warm --exam-* paper, Source Serif 4 headings, and ZERO
// gamification — no hints, no streak, no per-item correct/incorrect feedback. The
// paper is answered silently (pick → Next), graded objectively at the end, and
// banded Pass/Merit/Distinction. All items are single-pick MCQ, so one warm option
// renderer + assembleOptions grading serves the whole paper.
//
// Notation still renders on the light --paper card even here (rule 1) via
// NotationCard — the exam register never inverts notation.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { buildExamPaper, examMinutes, examSeconds, tallyExam, type Band, type ExamResult, EXAM_BANDS } from '../../learn/exam';
import { assembleOptions, type Option } from '../grading';
import { NotationCard } from '../components/NotationCard';
import { Screen } from '../Screen';
import { colors, examColors as x, shape, type } from '../theme';

type Phase = 'start' | 'paper' | 'review' | 'results';

/** mm:ss — the exam clock. */
function clock(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

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
  const [flagged, setFlagged] = useState<readonly number[]>([]);
  const [remaining, setRemaining] = useState(() => examSeconds(paper));

  // The clock runs from Begin to submit and never pauses (design 3b's exam-day copy
  // promises exactly that). Running out submits the paper as it stands — unanswered
  // questions simply score nothing, which is what tallyExam already does.
  useEffect(() => {
    if (phase !== 'paper' && phase !== 'review') return;
    const tick = setInterval(() => {
      setRemaining((left) => {
        if (left <= 1) {
          clearInterval(tick);
          setPhase('results');
          return 0;
        }
        return left - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [phase]);

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

  const answered = picks.filter((p) => p != null).length;
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
          <View style={styles.startHead}>
            <Pressable testID="exam-cancel" onPress={onExit} hitSlop={12}>
              <Text style={styles.close}>×</Text>
            </Pressable>
            <Text style={styles.overline}>Assessment mode</Text>
          </View>
          <Text style={styles.h1}>Practice Exam Paper</Text>
          <Text style={styles.conditions}>Grade {grade} · exam conditions</Text>

          <View style={styles.statRow}>
            {[
              { value: examMinutes(paper), label: 'MINUTES' },
              { value: paper.totalMarks, label: 'MARKS' },
              { value: paper.sections.length, label: 'SECTIONS' },
            ].map((tile) => (
              <View key={tile.label} style={styles.statTile}>
                <Text style={styles.statValue}>{tile.value}</Text>
                <Text style={styles.stat}>{tile.label}</Text>
              </View>
            ))}
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

  // ── Flagged review, before submit ────────────────────────────────────────────
  // The design puts a flag on every question but never shows where a flag leads;
  // this is that step — the paper isn't submitted until the learner has had the
  // chance to revisit what they marked. The clock keeps running throughout.
  if (phase === 'review') {
    return (
      <Screen style={styles.screen} testID="exam-review">
        <ScrollView contentContainerStyle={styles.startBody}>
          <Text style={styles.overline}>Before you submit</Text>
          <Text style={styles.h1}>
            You flagged {flagged.length} {flagged.length === 1 ? 'question' : 'questions'}.
          </Text>
          <Text style={styles.conditions}>
            {answered} of {paper.totalMarks} answered · {clock(remaining)} left
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            testID="exam-review-flagged"
            style={styles.primary}
            onPress={() => {
              setIndex(flagged[0]);
              setPhase('paper');
            }}
          >
            <Text style={styles.primaryLabel}>Review flagged ({flagged.length})</Text>
          </Pressable>
          <Pressable testID="exam-submit" onPress={() => setPhase('results')} style={styles.ghost}>
            <Text style={styles.ghostLabel}>Submit paper</Text>
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
  const isFlagged = flagged.includes(index);
  const currentSection = paper.sections.findIndex((s) => s.strand === q.section);

  const select = (i: number) => setPicks((prev) => prev.map((p, j) => (j === index ? i : p)));
  const toggleFlag = () =>
    setFlagged((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)));
  const next = () => {
    if (!isLast) return setIndex((i) => i + 1);
    setPhase(flagged.length > 0 ? 'review' : 'results');
  };

  return (
    <Screen style={styles.screen} testID="exam-paper">
      <View style={styles.examBar}>
        {/* Marks ANSWERED, not marks earned — a live score would tell the learner how
            they're doing mid-paper, which assessment mode does not do (rule 4). */}
        <Text testID="exam-marks" style={styles.marks}>
          <Text style={styles.marksNow}>{answered}</Text> / {paper.totalMarks} marks answered
        </Text>
        <View style={styles.timer}>
          <View style={styles.timerDot} />
          <Text testID="exam-timer" style={styles.timerLabel}>
            {clock(remaining)}
          </Text>
        </View>
      </View>

      <View style={styles.navigator} testID="exam-navigator">
        {paper.sections.map((s, i) => (
          <View
            key={s.strand}
            style={[
              styles.navSeg,
              i < currentSection && styles.navDone,
              i === currentSection && styles.navCurrent,
            ]}
          />
        ))}
      </View>

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

      <View style={styles.paperFooter}>
        <Pressable testID="exam-flag" onPress={toggleFlag} hitSlop={8} style={styles.flag}>
          <Text style={[styles.flagLabel, isFlagged && styles.flagOn]}>⚑ {isFlagged ? 'flagged' : 'flag'}</Text>
        </Pressable>
        <Pressable
          testID="exam-next"
          disabled={picked == null}
          onPress={next}
          style={[styles.primary, styles.nextButton, picked == null && styles.primaryDisabled]}
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
  startHead: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceInline },
  close: { fontFamily: type.label.fontFamily, fontSize: 20, color: x.muted },
  statRow: { flexDirection: 'row', gap: shape.spaceInline },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    backgroundColor: x.card,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderW,
    borderColor: x.border,
    paddingVertical: 12,
  },
  statValue: { fontFamily: type.examTitle.fontFamily, fontSize: 20, lineHeight: 24, color: x.ink },
  stat: { fontFamily: type.overline.fontFamily, fontSize: type.overline.fontSize, letterSpacing: type.overline.letterSpacing, color: x.faint },
  // exam bar (3c): answered-marks counter + the running clock
  examBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: 6,
    paddingBottom: shape.spaceInline,
  },
  marks: { fontFamily: type.label.fontFamily, fontSize: 12, color: x.muted },
  marksNow: { color: x.ink },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: x.card,
    borderWidth: shape.borderW,
    borderColor: x.border,
    borderRadius: shape.radiusChip,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  timerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: x.accent },
  timerLabel: { fontFamily: type.label.fontFamily, fontSize: 13, color: x.ink },
  // section navigator: sections done / current / still to come
  navigator: { flexDirection: 'row', gap: 5, paddingHorizontal: shape.spaceScreenX, paddingBottom: shape.spaceInline },
  navSeg: { flex: 1, height: 6, borderRadius: shape.radiusChip, backgroundColor: x.borderStrong },
  navDone: { backgroundColor: colors.correct },
  navCurrent: { flex: 1.4, backgroundColor: x.ink },
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
  paperFooter: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceCard, padding: shape.spaceScreenX },
  flag: { paddingVertical: 12 },
  flagLabel: { fontFamily: type.label.fontFamily, fontSize: 12, color: x.faint },
  flagOn: { color: x.accent },
  nextButton: { flex: 1 },
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
  // results. Ruling C: scannable numbers are ALWAYS mono, the results total
  // included — serif is for exam words (headings, band names), never digits.
  total: { fontFamily: type.label.fontFamily, fontSize: 44, lineHeight: 48, color: x.ink },
  totalOf: { fontFamily: type.label.fontFamily, fontSize: 22, color: x.muted },
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
