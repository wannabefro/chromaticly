// Design tokens as typed TS (KTD1). Transcribed from design/tokens/*.css. RN can't
// consume the CSS custom properties, so these constants are the single source for
// colour/type/spacing in the app UI — components read from here, never raw hex.
// Dark mode is the default and only register wired this slice; light/exam values are
// transcribed for completeness but unused (never-violate rule 5: don't preclude them).

/** Dark-register surfaces, text, notation paper, and semantic colours. */
export const colors = {
  // surfaces (dark)
  bg: '#0b0c0f',
  surface: '#111318',
  surfaceCard: '#1a1d24',
  surfaceCardSunken: '#141619',
  border: '#23272f',
  borderStrong: '#2a2f39',
  tabbar: '#131519',

  // text (dark)
  text: '#f3f4f6',
  textMuted: '#969ba7',
  textFaint: '#6b7280',
  textGhost: '#565d69',

  // notation paper — SAME in both modes; notation never inverts (rule 1)
  paper: '#f6f4ee',
  paperInk: '#1a1a1a',
  paperLine: '#2b2b2b',
  paperMuted: '#9a9488',
  paperSlot: '#d8d3c4',
  // On-paper grading marks (turn9 9b) — these read against the light `--paper`
  // card regardless of theme (rule 1), so they live alongside the paper tokens
  // rather than the dark `correct`/`incorrect` pair, which is tuned for dark
  // surfaces and doesn't match turn9's on-paper ✓/✗ (`#c9423d` vs `incorrect`'s
  // `#e0575e` — flagged for a later token-file sync, plan deviation 3).
  paperCorrect: '#3a9e63',
  paperIncorrect: '#c9423d',

  // semantic
  correct: '#57cf87',
  correctDeep: '#08351d',
  correctSurface: '#14231a',
  incorrect: '#f0666f', // warm, not punishing
  incorrectDeep: '#3a0d10',
  incorrectSurface: '#231619',
  hint: '#f0c489',
  hintSurface: '#241f12',
} as const;

/** Exam register (assessment mode ONLY, never-violate rule 4). Warm paper, serif
 *  headings, and merit banding — transcribed from design/tokens/colors.css. Kept
 *  a separate object (not merged into `colors`) so exam surfaces opt in explicitly
 *  and normal screens can never accidentally pick up the exam palette. */
export const examColors = {
  bg: '#f2efe8',
  card: '#fbfaf6',
  border: '#e2dccc',
  borderStrong: '#d8d0bd',
  ink: '#23201a',
  muted: '#8a8272',
  faint: '#a0977f',
  accent: '#c9964f', // timer, merit band
  bandPass: '#b8ab8c',
  bandMerit: '#c9964f',
  bandDistinction: '#a8843c',
} as const;

/** 7-hue brand gradient stops (logo/score rings), in strand order. */
export const brandGradient = [
  '#f0666f',
  '#f0a94f',
  '#57cf87',
  '#2fbfae',
  '#46b0e6',
  '#8b8ef2',
  '#cb7ad4',
] as const;

/** Radii, borders, spacing, tap targets (design/tokens/shape.css). */
export const shape = {
  radiusCard: 18,
  radiusCardLg: 22,
  radiusButton: 15,
  radiusControl: 13,
  radiusPaper: 16,
  radiusChip: 999,
  radiusSwatch: 3,

  borderW: 1,
  borderWActive: 1.5,

  spaceScreenX: 20,
  spaceCard: 16,
  spaceStack: 16,
  spaceInline: 12,

  tapMin: 44,
} as const;

/** Font families (loaded via expo-font in _layout; keys match the loaded names). */
export const fonts = {
  ui: 'Figtree_400Regular',
  uiMedium: 'Figtree_500Medium',
  uiSemibold: 'Figtree_600SemiBold',
  uiBold: 'Figtree_700Bold',
  uiHeavy: 'Figtree_800ExtraBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  music: 'NotoMusic_400Regular',
  // exam register (Source Serif 4) — assessment-mode headings only (rule 4).
  examMedium: 'SourceSerif4_500Medium',
  examSemibold: 'SourceSerif4_600SemiBold',
  examBold: 'SourceSerif4_700Bold',
} as const;

/** Type scale (mobile, 384pt frame) — sizes/weights from typography.css. */
export const type = {
  hero: { fontFamily: fonts.uiHeavy, fontSize: 27, lineHeight: 31 },
  title: { fontFamily: fonts.uiHeavy, fontSize: 24, lineHeight: 28 },
  prompt: { fontFamily: fonts.uiBold, fontSize: 20, lineHeight: 27 },
  cardTitle: { fontFamily: fonts.uiBold, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 22 },
  option: { fontFamily: fonts.uiSemibold, fontSize: 16, lineHeight: 21 },
  label: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 15 },
  overline: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 15, letterSpacing: 1.3, textTransform: 'uppercase' as const },
  // Exam register headings swap to the serif face (rule 4); exam body stays sans
  // (reuse `body`). Assessment mode only.
  examTitle: { fontFamily: fonts.examBold, fontSize: 24, lineHeight: 28 },
  examPrompt: { fontFamily: fonts.examSemibold, fontSize: 20, lineHeight: 27 },
} as const;

export const elevation = {
  paper: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  sheet: { shadowColor: '#000', shadowOffset: { width: 0, height: -20 }, shadowOpacity: 0.5, shadowRadius: 40, elevation: 16 },
} as const;
