// Grade-1 practice exam (302.2, design 3b/3c/3d). Assessment mode shifts register
// (never-violate rule 4): warm --exam-* paper, Source Serif 4 headings, and ZERO
// gamification — no hints, no streak, no per-item correct/incorrect feedback. The
// paper is answered silently (pick → Next), graded objectively at the end, and
// banded Pass/Merit/Distinction. All items are single-pick MCQ, so one warm option
// renderer + assembleOptions grading serves the whole paper.
//
// Notation still renders on the light --paper card even here (rule 1) via
// NotationCard — the exam register never inverts notation.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { buildExamPaper, examMinutes, examSeconds, tallyExam, type Band, type ExamPaper, type ExamResult, EXAM_BANDS } from '../../learn/exam';
import { useProgressContext } from '../../learn/ProgressContext';
import { assembleOptions, type Option } from '../grading';
import { ExamReview } from './ExamReview';
import { NotationCard } from '../components/NotationCard';
import { Screen } from '../Screen';
import { colors, examColors as x, glyph, shape, type } from '../theme';

type Phase = 'start' | 'paper' | 'review' | 'results' | 'marked';

/** mm:ss — the exam clock. */
function clock(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** 8a's headline states exactly what is outstanding — no score, no judgement. */
function reviewHeadline(flags: number, blanks: number): string {
  if (flags > 0 && blanks > 0) {
    return `You flagged ${plural(flags, 'question', 'questions')} and left ${plural(blanks, 'unanswered', 'unanswered')}.`;
  }
  if (blanks > 0) return `You left ${plural(blanks, 'question', 'questions')} unanswered.`;
  if (flags > 0) return `You flagged ${plural(flags, 'question', 'questions')}.`;
  return 'Everything is answered.';
}

function questionsOfSection(paper: ExamPaper, strand: string): number[] {
  return paper.questions.flatMap((q, i) => (q.section === strand ? [i] : []));
}

/** The question number the learner sees (1-based across the whole paper). */
const qNumber = (paper: ExamPaper, index: number) => index + 1;

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
  /** The result screen's primary action (7e/R6): go and work on the lane the paper
   *  says is weakest. Falls back to `onExit` where no caller can route. */
  onOpenLane?: (strand: string) => void;
  /** Strands pre-exam readiness had already flagged, for the continuity marker
   *  ("we flagged this before the paper"). Empty means no marker.
   *
   *  REQUIRED since U12 deleted the level map, the one caller that could not
   *  supply it. Recomputing readiness here instead would resurrect the inversion
   *  U12 removes: a prediction of the paper standing in for the paper's verdict. */
  flaggedBefore: readonly string[];
}

export function ExamRunner({ grade, onExit, paperSeed = 0, onOpenLane, flaggedBefore }: ExamRunnerProps) {
  const { recordExamResult } = useProgressContext();
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

  const correctByQuestion = useMemo(
    () =>
      paper.questions.map((_, i) => {
        const pick = picks[i];
        return pick != null && optionsByQuestion[i][pick]?.correct === true;
      }),
    [paper, picks, optionsByQuestion],
  );

  const result: ExamResult = useMemo(
    () => tallyExam(paper, correctByQuestion),
    [paper, correctByQuestion],
  );

  /** The section the paper says to work on next: fewest marks first, ties broken by
   *  the paper's own section order. Null when every section is at or above the pass
   *  fraction — with nothing to revise, "Review paper" stays the primary action
   *  rather than the screen inventing a weakness to send the learner at. */
  const worstSection = useMemo(() => {
    const weak = result.sections.filter((s) => s.correct < Math.ceil(EXAM_BANDS.pass * s.total));
    if (weak.length === 0) return null;
    return weak.reduce((worst, s) => (s.correct / s.total < worst.correct / worst.total ? s : worst));
  }, [result.sections]);

  // D7: record the exam-clear fact exactly once on entering results — a
  // fired-once ref (not just the phase check) so a re-render while still on
  // `results` (e.g. from the revision bump this itself causes) can't record
  // twice. Must stay top-level, before any early return, so the hook always
  // runs in the same order across renders.
  const resultRecorded = useRef(false);
  useEffect(() => {
    if (phase !== 'results' || resultRecorded.current) return;
    resultRecorded.current = true;
    recordExamResult(grade, result.band);
  }, [phase, result.band, grade, recordExamResult]);

  const answered = picks.filter((p) => p != null).length;
  const unanswered = picks.flatMap((p, i) => (p == null ? [i] : []));
  // A blank costs a mark; a flag is only a note to self — so blanks come first.
  const needsAttention = [...unanswered, ...flagged.filter((i) => picks[i] != null)];
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

          {/* 7e — the result IS the next session's plan (R6). Shading and the primary
              action below both come from what the learner got wrong TODAY, never from
              the pre-exam prediction: readiness rides along only as a separately
              labelled continuity marker. An earlier draft had readiness doing the
              shading and the routing, which quietly replaced the paper's verdict with
              a forecast of it. */}
          <View style={styles.card}>
            {result.sections.map((s) => {
              const weak = s.correct < Math.ceil(EXAM_BANDS.pass * s.total);
              const flagged = flaggedBefore?.includes(s.strand) ?? false;
              return (
                <View key={s.strand} style={styles.sectionRow} testID={`exam-section-${s.strand}`}>
                  <View style={styles.sectionNameCol}>
                    <Text style={styles.sectionName}>{s.title}</Text>
                    {flagged && (
                      <Text style={styles.flagged} testID={`exam-section-${s.strand}-flagged`}>
                        we flagged this before the paper
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.sectionMarks, weak && styles.weak]} testID={`exam-section-${s.strand}-marks`}>
                    {s.correct}/{s.total}
                    {weak ? '  · revise' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {/* The new primary: the paper's own worst section, one tap away. "Review
              paper" is demoted to a visible secondary rather than replaced — R8 keeps
              the exam register's behaviour, `exam-paper.yaml` drives it, and it is the
              thing a learner most wants immediately after a paper. */}
          {worstSection && (
            <Pressable
              testID="exam-revise-worst"
              style={styles.primary}
              onPress={() => (onOpenLane ? onOpenLane(worstSection.strand) : onExit())}
            >
              <Text style={styles.primaryLabel}>Work on {worstSection.title}</Text>
            </Pressable>
          )}
          <Pressable
            testID="exam-review-paper"
            style={worstSection ? styles.ghost : styles.primary}
            onPress={() => setPhase('marked')}
          >
            <Text style={worstSection ? styles.ghostLabel : styles.primaryLabel}>Review paper</Text>
          </Pressable>
          <Pressable testID="exam-back-to-learn" onPress={onExit} style={styles.ghost}>
            <Text style={styles.ghostLabel}>Back to Learn</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // ── Reviewing the marked paper (8b) ─────────────────────────────────────────
  if (phase === 'marked') {
    return (
      <ExamReview
        paper={paper}
        picks={picks}
        optionsByQuestion={optionsByQuestion}
        correct={correctByQuestion}
        total={result.total}
        bandLabel={BAND_LABEL[result.band]}
        onClose={() => setPhase('results')}
        onRevise={onExit}
      />
    );
  }

  // ── Before you submit (8a) ───────────────────────────────────────────────────
  // Nothing is graded here: this screen is about what still needs the learner's
  // attention, never about how they did. Unanswered questions rank above flags —
  // a flag is a note to self, a blank is a lost mark.
  if (phase === 'review') {
    const jumpTo = (i: number) => {
      setIndex(i);
      setPhase('paper');
    };
    const first = needsAttention[0];

    return (
      <Screen style={styles.screen} testID="exam-review">
        <View style={styles.examBar}>
          <Text style={styles.marks}>
            <Text style={styles.marksNow}>{answered}</Text> / {paper.totalMarks} answered
          </Text>
          <View style={styles.timer}>
            <View style={styles.timerDot} />
            <Text testID="exam-timer" style={styles.timerLabel}>
              {clock(remaining)}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.startBody}>
          <Text style={styles.overline}>Before you submit</Text>
          <Text style={styles.h1}>{reviewHeadline(flagged.length, unanswered.length)}</Text>
          <Text style={styles.conditions}>The clock keeps running while you review.</Text>

          <View style={styles.card}>
            {paper.sections.map((s, si) => {
              const qs = questionsOfSection(paper, s.strand);
              const flags = qs.filter((i) => flagged.includes(i));
              const blanks = qs.filter((i) => picks[i] == null);
              const settled = flags.length === 0 && blanks.length === 0;
              const target = blanks[0] ?? flags[0] ?? qs[0];

              return (
                <Pressable
                  key={s.strand}
                  testID={`exam-review-section-${s.strand}`}
                  onPress={() => jumpTo(target)}
                  style={styles.sectionRow}
                >
                  <Text style={styles.sectionName}>
                    S{si + 1} {s.title}
                  </Text>
                  {settled ? (
                    <Text style={styles.sectionMarks}>
                      {qs.length}/{qs.length} ●
                    </Text>
                  ) : (
                    <Text style={[styles.sectionMarks, blanks.length > 0 && styles.blank]}>
                      {blanks.length > 0 && `Q${blanks.map((i) => qNumber(paper, i)).join(' · Q')} unanswered`}
                      {blanks.length > 0 && flags.length > 0 && '  '}
                      {flags.length > 0 && `⚑ Q${flags.map((i) => qNumber(paper, i)).join(' · Q')}`}
                      {'  ›'}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.note}>
            Tap any row to jump there. Flags clear when you re-answer, or stay — they’re just for you.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          {first != null ? (
            <>
              <Pressable testID="exam-review-flagged" style={styles.primary} onPress={() => jumpTo(first)}>
                <Text style={styles.primaryLabel}>Review flagged &amp; unanswered ({needsAttention.length})</Text>
              </Pressable>
              {/* Demoted while anything still needs attention — submitting over a blank
                  should take a deliberate second look, not a reflex tap. */}
              <Pressable testID="exam-submit" onPress={() => setPhase('results')} style={styles.ghost}>
                <Text style={styles.ghostLabel}>Submit paper now</Text>
              </Pressable>
            </>
          ) : (
            <Pressable testID="exam-submit" style={styles.primary} onPress={() => setPhase('results')}>
              <Text style={styles.primaryLabel}>Submit paper</Text>
            </Pressable>
          )}
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
    // Anything outstanding — a flag or a blank — goes through 8a rather than being
    // graded behind the learner's back.
    setPhase(needsAttention.length > 0 ? 'review' : 'results');
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
        {/* A question may be left blank and come back to — that is what 8a's
            "unanswered" rows are for, and it is how a real paper works. Blanks simply
            score nothing; the review screen makes sure they are a choice, not an
            accident. */}
        <Pressable testID="exam-next" onPress={next} style={[styles.primary, styles.nextButton]}>
          <Text style={styles.primaryLabel}>
            {isLast ? 'Finish paper' : picked == null ? 'Skip' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: x.bg },
  startBody: { padding: shape.spaceScreenX, gap: shape.spaceCard, paddingBottom: shape.spaceScreenBottom },
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
  close: { fontFamily: type.label.fontFamily, fontSize: glyph.md, color: x.muted },
  statRow: { flexDirection: 'row', gap: shape.spaceInline },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: shape.spaceHairline,
    backgroundColor: x.card,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderW,
    borderColor: x.border,
    paddingVertical: shape.spaceInline,
  },
  statValue: { fontFamily: type.examTitle.fontFamily, fontSize: type.prompt.fontSize, lineHeight: 24, color: x.ink },
  stat: { fontFamily: type.overline.fontFamily, fontSize: type.overline.fontSize, letterSpacing: type.overline.letterSpacing, color: x.faint },
  // exam bar (3c): answered-marks counter + the running clock
  examBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceSnug,
    paddingBottom: shape.spaceInline,
  },
  marks: { fontFamily: type.label.fontFamily, fontSize: type.caption.fontSize, color: x.muted },
  marksNow: { color: x.ink },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceSnug,
    backgroundColor: x.card,
    borderWidth: shape.borderW,
    borderColor: x.border,
    borderRadius: shape.radiusChip,
    paddingHorizontal: shape.spaceInline,
    paddingVertical: shape.spaceTight,
  },
  timerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: x.accent },
  timerLabel: { fontFamily: type.label.fontFamily, fontSize: type.body.fontSize, color: x.ink },
  // section navigator: sections done / current / still to come
  navigator: { flexDirection: 'row', gap: shape.spaceTight, paddingHorizontal: shape.spaceScreenX, paddingBottom: shape.spaceInline },
  navSeg: { flex: 1, height: 6, borderRadius: shape.radiusChip, backgroundColor: x.borderStrong },
  navDone: { backgroundColor: colors.correct },
  navCurrent: { flex: 1.4, backgroundColor: x.ink },
  card: {
    backgroundColor: x.card,
    borderRadius: shape.radiusCard,
    borderWidth: shape.borderW,
    borderColor: x.border,
    padding: shape.spaceCard,
    gap: shape.spaceInline,
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: shape.spaceInline },
  sectionNameCol: { flex: 1, minWidth: 0 },
  // The continuity marker sits UNDER the section name and in the muted register, so
  // it reads as a footnote to the paper's verdict rather than competing with it.
  flagged: { fontFamily: type.label.fontFamily, fontSize: type.label.fontSize, color: x.faint },
  sectionName: { fontFamily: type.examPrompt.fontFamily, fontSize: type.cardTitle.fontSize, lineHeight: 21, color: x.ink },
  // Marks are numbers users scan, so they're mono (design/README.md).
  sectionMarks: { fontFamily: type.label.fontFamily, fontSize: type.body.fontSize, color: x.muted },
  weak: { color: x.accent },
  // A blank is not a mistake, but it is a lost mark — it outranks a flag.
  blank: { color: x.bandDistinction },
  bandLine: { fontFamily: type.body.fontFamily, fontSize: type.body.fontSize, color: x.muted },
  note: { fontFamily: type.body.fontFamily, fontSize: type.body.fontSize, color: x.faint },
  footer: { padding: shape.spaceScreenX, gap: shape.spaceInline },
  paperFooter: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceCard, padding: shape.spaceScreenX },
  flag: { paddingVertical: shape.spaceInline },
  flagLabel: { fontFamily: type.label.fontFamily, fontSize: type.caption.fontSize, color: x.faint },
  flagOn: { color: x.accent },
  nextButton: { flex: 1 },
  primary: {
    backgroundColor: x.accent,
    borderRadius: shape.radiusButton,
    paddingVertical: shape.spaceCard,
    alignItems: 'center',
    minHeight: shape.tapMin,
    justifyContent: 'center',
  },
  primaryDisabled: { opacity: 0.4 },
  primaryLabel: { fontFamily: type.examPrompt.fontFamily, fontSize: type.option.fontSize, color: x.card },
  ghost: { paddingVertical: shape.spaceInline, alignItems: 'center' },
  ghostLabel: { fontFamily: type.body.fontFamily, fontSize: type.body.fontSize, color: x.muted },
  // results. Ruling C: scannable numbers are ALWAYS mono, the results total
  // included — serif is for exam words (headings, band names), never digits.
  total: { fontFamily: type.label.fontFamily, fontSize: type.display.fontSize, lineHeight: type.display.lineHeight, color: x.ink },
  totalOf: { fontFamily: type.label.fontFamily, fontSize: type.prompt.fontSize, color: x.muted },
  bandChip: { alignSelf: 'flex-start', borderRadius: shape.radiusChip, paddingHorizontal: shape.spaceCard, paddingVertical: shape.spaceSnug },
  bandChipLabel: { fontFamily: type.examPrompt.fontFamily, fontSize: type.cardTitle.fontSize, color: x.card },
  // paper
  paperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceTight,
    paddingBottom: shape.spaceInline,
    borderBottomWidth: shape.borderW,
    borderBottomColor: x.border,
  },
  sectionTag: { fontFamily: type.examPrompt.fontFamily, fontSize: type.cardTitle.fontSize, color: x.ink },
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
  optionLabel: { fontFamily: type.body.fontFamily, fontSize: type.option.fontSize, lineHeight: 21, color: x.ink },
  optionLabelSelected: { color: x.ink },
});
