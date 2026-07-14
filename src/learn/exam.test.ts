// 302.2 exam model: a Grade-1 paper across the 5 built strands, tallied and banded
// (rule 4). Guards that the paper is derived from Grade-1 content (not the design's
// Grade-3 example) and that banding matches the ABRSM-style thresholds.

import {
  bandFor,
  buildExamPaper,
  EXAM_BANDS,
  examMinutes,
  examSeconds,
  GRADE1_EXAM_SECTIONS,
  QUESTIONS_PER_SECTION,
  tallyExam,
} from './exam';

describe('exam model — Grade-1 paper (302.2)', () => {
  test('covers exactly the 5 built Grade-1 strands (no chords / music-in-context)', () => {
    const strands = GRADE1_EXAM_SECTIONS.map((s) => s.strand);
    expect(strands).toEqual(['rhythm', 'pitch', 'scales_keys', 'intervals', 'terms_signs']);
    expect(strands).not.toContain('chords');
    expect(strands).not.toContain('context');
  });

  test('the terms section is objectively graded (term_meaning MCQ, not the self-graded flashcard)', () => {
    const terms = GRADE1_EXAM_SECTIONS.find((s) => s.strand === 'terms_signs')!;
    expect(terms.templates).toContain('term_meaning');
    expect(terms.templates).not.toContain('term_meaning_flashcard');
  });

  test('buildExamPaper is deterministic and produces QUESTIONS_PER_SECTION per section, all objectively gradable', () => {
    const a = buildExamPaper(0);
    const b = buildExamPaper(0);
    expect(a.questions.map((q) => q.instance.id)).toEqual(b.questions.map((q) => q.instance.id));
    expect(a.totalMarks).toBe(GRADE1_EXAM_SECTIONS.length * QUESTIONS_PER_SECTION);
    for (const s of GRADE1_EXAM_SECTIONS) {
      expect(a.questions.filter((q) => q.section === s.strand)).toHaveLength(QUESTIONS_PER_SECTION);
    }
    // Uniform silent-MCQ paper: every item is a single-pick mcq (no flashcard, no
    // per-bar true/false), so one warm option renderer + assembleOptions grades all.
    expect(a.questions.every((q) => q.instance.interaction.type === 'mcq')).toBe(true);
  });

  test('seeds are unique across the paper (no repeated question)', () => {
    const paper = buildExamPaper(3);
    const ids = paper.questions.map((q) => q.instance.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('bandFor applies the ABRSM-style thresholds', () => {
    expect(bandFor(100, 100)).toBe('distinction');
    expect(bandFor(Math.ceil(EXAM_BANDS.distinction * 100), 100)).toBe('distinction');
    expect(bandFor(80, 100)).toBe('merit');
    expect(bandFor(66, 100)).toBe('pass');
    expect(bandFor(65, 100)).toBe('below');
    expect(bandFor(0, 0)).toBe('below');
  });

  test('tallyExam sums per-section and overall from per-question correctness', () => {
    const paper = buildExamPaper(0);
    // Mark every rhythm question right, everything else wrong.
    const correct = paper.questions.map((q) => q.section === 'rhythm');
    const result = tallyExam(paper, correct);

    expect(result.total).toBe(QUESTIONS_PER_SECTION);
    expect(result.totalMarks).toBe(paper.totalMarks);
    const rhythm = result.sections.find((s) => s.strand === 'rhythm')!;
    expect(rhythm.correct).toBe(QUESTIONS_PER_SECTION);
    expect(result.sections.find((s) => s.strand === 'pitch')!.correct).toBe(0);
    expect(result.band).toBe('below'); // one of five sections → 20%
  });

  test('a full-marks paper bands Distinction', () => {
    const paper = buildExamPaper(1);
    const result = tallyExam(paper, paper.questions.map(() => true));
    expect(result.total).toBe(paper.totalMarks);
    expect(result.band).toBe('distinction');
  });

  // The time limit is ABRSM's own ratio (90 minutes for 75 marks), not the design's
  // literal "90 MINUTES" — that tile belongs to its 75-mark Grade 3 example paper.
  // Deriving it means the limit tracks the paper instead of going stale beside it.
  test('the time limit is derived from the paper, not hardcoded', () => {
    const paper = buildExamPaper(0);
    expect(examMinutes(paper)).toBe(Math.round(paper.totalMarks * (90 / 75)));
    expect(examSeconds(paper)).toBe(examMinutes(paper) * 60);

    const longer = { ...paper, totalMarks: paper.totalMarks * 2 };
    expect(examMinutes(longer)).toBe(examMinutes(paper) * 2);
  });
});
