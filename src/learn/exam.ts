// Grade 1 practice exam model (302.2, design 3b/3c/3d). Assessment mode: a silent
// paper across the built Grade-1 strands, graded objectively at the end and banded
// Pass/Merit/Distinction (never-violate rule 4 — no hints/streak/XP; the register
// shift + zero gamification live in the exam UI). Derived from Grade-1 content
// (not the design's Grade-3 example): 5 sections, one per built strand.
//
// The terms section uses the objective `term_meaning` MCQ, NOT the lesson's
// self-graded `term_meaning_flashcard` — a self-assessment can't be a mark.
//
// Pure + RN/expo-free (core-boundary): only depends on the generators + content.

import { lessonById } from '../content/lessons';
import { generate } from '../engine/generators';
import type { ExerciseInstance } from '../engine/schema';

export interface ExamSection {
  strand: string;
  title: string;
  templates: string[];
  atoms: string[];
}

function atomsOf(...lessonIds: string[]): string[] {
  return lessonIds.flatMap((id) => lessonById(id)?.atoms ?? []);
}

// The exam is a uniform silent MCQ paper (single pick per question), so every
// section template must be an `mcq` generator — that's what lets one warm-register
// option renderer + assembleOptions grading serve the whole paper. Rhythm therefore
// uses its two MCQ formats (rhythm_sum, add_time_signature); bar_validity (per-bar
// tick/cross) stays a lesson interaction, not an exam one.
/** The five objectively-gradable Grade-1 strands, in exam order. */
export const GRADE1_EXAM_SECTIONS: ExamSection[] = [
  { strand: 'rhythm', title: 'Rhythm & Metre', templates: ['rhythm_sum', 'add_time_signature'], atoms: atomsOf('note-values') },
  { strand: 'pitch', title: 'Pitch & Notation', templates: ['note_naming'], atoms: atomsOf('treble-notes', 'bass-notes', 'accidentals') },
  { strand: 'scales_keys', title: 'Keys & Scales', templates: ['key_signature_id'], atoms: atomsOf('key-signatures') },
  { strand: 'intervals', title: 'Intervals', templates: ['interval_naming'], atoms: atomsOf('intervals') },
  { strand: 'terms_signs', title: 'Terms & Signs', templates: ['term_meaning'], atoms: atomsOf('dynamics-1', 'tempo-1', 'signs-1') },
];

export const QUESTIONS_PER_SECTION = 4;

/** ABRSM allows 90 minutes for a 75-mark paper. The design's "90 MINUTES" tile is
 *  that paper (its Grade 3 example); ours is derived from Grade 1 content and is a
 *  different length, so the ratio is what carries over, not the number — and the
 *  limit then scales on its own as the paper grows. */
export const EXAM_MINUTES_PER_MARK = 90 / 75;

export function examMinutes(paper: ExamPaper): number {
  return Math.round(paper.totalMarks * EXAM_MINUTES_PER_MARK);
}

/** The exam clock never pauses (design: "no timer pauses"), so this is the whole
 *  budget from Begin to auto-submit. */
export function examSeconds(paper: ExamPaper): number {
  return examMinutes(paper) * 60;
}

/** ABRSM-style bands as fractions of the total (Pass 66% / Merit 80% / Dist 90%). */
export const EXAM_BANDS = { pass: 0.66, merit: 0.8, distinction: 0.9 } as const;
export type Band = 'below' | 'pass' | 'merit' | 'distinction';

export interface ExamQuestion {
  section: string;
  sectionTitle: string;
  instance: ExerciseInstance;
}

export interface ExamPaper {
  questions: ExamQuestion[];
  totalMarks: number;
  sections: ExamSection[];
}

/** Assemble a deterministic paper: QUESTIONS_PER_SECTION items per section, each a
 *  unique seed so no two questions repeat. One mark per question. */
export function buildExamPaper(paperSeed = 0): ExamPaper {
  const questions: ExamQuestion[] = [];
  let n = 0;
  for (const section of GRADE1_EXAM_SECTIONS) {
    for (let i = 0; i < QUESTIONS_PER_SECTION; i++) {
      const template = section.templates[i % section.templates.length];
      const seed = paperSeed * 1000 + n;
      questions.push({
        section: section.strand,
        sectionTitle: section.title,
        // Deliberately grade: 1, not threaded (D11): this builds the Grade-1 paper by
        // definition — generalizing to other grades is the Grade-2-exam slice's job.
        instance: generate(template, { grade: 1, seed, atoms: section.atoms }),
      });
      n++;
    }
  }
  return { questions, totalMarks: questions.length, sections: GRADE1_EXAM_SECTIONS };
}

/** The one grade with a real paper this slice. Named rather than repeated as a
 *  literal, because readiness (G6 U8) and the gate now both have to agree on it —
 *  a readiness card about a paper that does not exist is a promise the app cannot
 *  keep. Widening the paper set is one edit here plus `hasExamPaper`. */
export const EXAM_PAPER_GRADE = 1;

/** Whether `grade` has a real exam paper (D8). Only Grade 1 does this slice —
 *  `buildExamPaper` is Grade-1-only, and a stub "Grade 2 exam" would
 *  misrepresent an exam paper. Gate `onPress` on both exam-gate call sites
 *  with this, so a gate never opens onto a paper that doesn't exist. */
export function hasExamPaper(grade: number): boolean {
  return grade === EXAM_PAPER_GRADE;
}

export function bandFor(total: number, totalMarks: number): Band {
  const frac = totalMarks === 0 ? 0 : total / totalMarks;
  if (frac >= EXAM_BANDS.distinction) return 'distinction';
  if (frac >= EXAM_BANDS.merit) return 'merit';
  if (frac >= EXAM_BANDS.pass) return 'pass';
  return 'below';
}

export interface SectionResult {
  strand: string;
  title: string;
  correct: number;
  total: number;
}

export interface ExamResult {
  total: number;
  totalMarks: number;
  band: Band;
  sections: SectionResult[];
}

/** Tally a completed paper from per-question correctness. `correctByIndex[i]`
 *  is whether question i was answered correctly — the UI computes it via each
 *  item's interaction spec (which lives on the RN side), keeping this core module
 *  free of any UI import. Missing/undefined entries count as incorrect. */
export function tallyExam(paper: ExamPaper, correctByIndex: boolean[]): ExamResult {
  const byStrand = new Map<string, SectionResult>();
  for (const section of paper.sections) {
    byStrand.set(section.strand, { strand: section.strand, title: section.title, correct: 0, total: 0 });
  }

  let total = 0;
  paper.questions.forEach((q, i) => {
    const row = byStrand.get(q.section)!;
    row.total += 1;
    if (correctByIndex[i] === true) {
      row.correct += 1;
      total += 1;
    }
  });

  return {
    total,
    totalMarks: paper.totalMarks,
    band: bandFor(total, paper.totalMarks),
    sections: [...byStrand.values()],
  };
}
