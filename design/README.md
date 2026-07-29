# Chromaticly Design System

A free app teaching graded music theory (Grades 1–5, aligned to the UK exam-board syllabus; mapped as Levels 1–5). Native mobile (React Native) + web (React); mobile-first at 384pt, layouts scale up. Content: 5 Levels × 7 Strands → units → lessons → exercise sets, plus SRS practice, and practice exam papers per level. **Audio is the differentiator: everything sounds.**

Sources: product brief pasted in project chat (graded music-theory curriculum & exercise construction spec). No external Figma/codebase. All screens live in `Chromaticly Core Flows.dc.html` (pannable canvas, screens tagged 2a–4e).

## Design principles (from the brief — treat as law)
1. **The stave is the hero.** Notation renders large, crisp, centred; chrome recedes. Never crop a stave.
2. **Everything sounds.** Every notation display has a play affordance.
3. **One question, one screen.** Slim segmented progress bar.
4. **Wrong answers teach.** Feedback names the misconception; it is a designed bottom sheet, not a toast.
5. **Progress is per-skill.** 7-strand mastery always visible.
6. **Exam fidelity at the gates.** Assessment mode shifts register: paper, serif, zero gamification.

## CONTENT FUNDAMENTALS
- Tone: encouraging, calm, musical. Adult-respectful, child-friendly. Never toddler-gamified, never exam-sterile (except assessment mode, which is deliberately sober).
- Voice: second person ("you'll learn"), first-name greeting ("Nicely done, Maya").
- Casing: sentence case everywhere. Mono overlines are uppercase+tracked ("PITCH & NOTATION").
- Encouragement is specific and gentle: "5 days · keep it gentle", "Not quite" (never "Wrong!"). Wrong-answer copy names the misconception: "That's the note's name in the bass clef — check the clef sign."
- UK terminology is default (crotchet, minim, semibreve, bar); a settings toggle relabels to US (quarter note…). Write copy so terms are swappable nouns.
- Numbers users scan (marks 42/75, counters 4/10, timers, %) are always mono.
- Emoji: sparing, functional only (💡 smart tip, 🎧 theory in sound, 🗂 review deck, 🔒 locked, ⚑ report/flag). Never decorative.
- Exam register copy is factual and unadorned: "No hints, no streaks, no timer pauses — just like exam day."

## VISUAL FOUNDATIONS
- **Modes:** dark is primary; light mode = warm paper surfaces + ink text. A third register, **exam** (`--exam-*`), is warmer paper + `Source Serif 4` headings, used only in assessment mode.
- **Color:** near-black blue-grey surfaces (`#0b0c0f/#111318/#1a1d24`), 7-strand chromatic accents (see tokens/colors.css). One accent per screen — the current strand's hue drives the progress bar, selected states, and primary button. Strand color is ALWAYS paired with a glyph or label (colour-vision safety). **Exception (approved 2026-07-28): the strand radar and any surface that IS the radar** — notably the lane-based Learn tab under non-linear progression — carries all seven hues at once, because no single strand is "current" there. Such a screen keeps its own accent neutral (`--text`) so nothing reads as the current strand, and every hue still carries its glyph and name. This exception does not extend to exercise, lesson, or exam screens, which always have exactly one current strand.
- **Notation paper:** notation never inverts. It always sits on `--paper #f6f4ee` with near-black ink, both modes. Paper cards get the only drop shadows in the dark UI.
- **Backgrounds:** flat surfaces + 1px borders; no gradients except (a) the 7-hue brand gradient in the logo/score rings, (b) very subtle dark duotones on hero cards. Signature motif: **faint horizontal staff-line texture** on hero/flashcards via `repeating-linear-gradient(0deg, transparent 0 11px, <strand tint ~10%> 11px 12px)`.
- **Cards:** radius 16–22px, 1px border, no shadow (dark). Selected/interactive: 1.5px border in strand hue + 12–16% tint fill. Locked: dashed border, 0.55–0.65 opacity.
- **Buttons:** primary = filled strand hue (or `--text` white for neutral moments), bold 15–16px, radius 15px, full width in footers. Text-only secondary beneath. Press state: scale 0.98 + darken 8%.
- **Progress:** slim segmented bars (per-question), 999px pills; rings (SVG stroke-dasharray) for topic/score; 7-point radar for strand mastery; diamond **mastery gems** per item (filled=clean, outlined=hint used, red-outlined=missed).
- **Motion:** quick and restrained; correct-answer micro-celebration ≤600ms; assessment mode has zero celebratory motion. Feedback sheet slides from bottom; content behind dims to 0.55.
- **Corner cases:** offline is a small chip (green dot + "offline"), never a blocking error.
- **Layout:** 20–22px screen gutters, 16px card stacks, flex/grid with gap. Tap targets ≥44px.
- **Shadows:** only paper cards, bottom sheets, and phone frames (see tokens/shape.css). No inner shadows, no blur/transparency effects.

## ICONOGRAPHY
- No icon font. Icons are minimal inline SVG strokes (2px, currentColor-style single hue): tab bar glyphs, play triangles, stat bars. Play affordance is always a solid triangle in a circle.
- Music glyphs come from **Noto Music** (Google Fonts) inline in text and SVG `<text>`: 𝄞 U+1D11E clef, ♯♭♮ accidentals, 𝅗𝅥/𝅘𝅥/𝅘𝅥𝅮 note values. In production, notation itself is rendered by abcjs/VexFlow into the paper card (`NotationCard` is the placeholder contract).
- Strand glyph pairings (for colour-vision-safe mode): Rhythm 𝅘𝅥, Pitch 𝄞, Scales ♯, Intervals ⟷, Chords ≡, Terms 𝆑, Context 𝄚.
- No logo mark exists yet — the brand renders as a 7-hue gradient rounded square + "Chromaticly" in Figtree 800. Do not invent a logo.

## Index
- `styles.css` → `tokens/colors.css`, `tokens/typography.css`, `tokens/shape.css`
- `components/core/` — Button, AnswerOption, NotationCard, PlayButton, StrandChip, ProgressSegments, MasteryGems, FeedbackSheet, RomanNumeralBoxes (+ .d.ts, .prompt.md each)
- `guidelines/` — foundation specimen cards (@dsCard)
- `Chromaticly Core Flows.dc.html` — all screens: exercise loop (2a–2f), SRS (2g–2h), level map + exam (3a–3d), lessons + context + light mode (4a–4e), onboarding/profile/interaction states (5a–…)
- `Progression Flow C.dc.html` — non-linear progression, spine C: the seven-lane model end to end, and the advisory cross-lane prerequisite band
- `Progression Screens C.dc.html` — **the normative layouts for spine C**, screens 7a–7e: Learn as seven lanes (7a), one lane opened with the advisory prereq chip (7b), the placement result shown honestly uneven (7c), exam readiness read off the whole vector (7d), and the per-skill exam result (7e)
- `Placement A vs B.dc.html` — the two placement shapes, screens A1–A2 and B1–B3, with the comparison that settled it: ship A's one mixed pass, keep B's ladder as the per-skill re-test
- `SKILL.md` — agent skill entry point

## Intentional additions
- `NotationCard` — placeholder contract for the real abcjs/VexFlow renderer (required by brief §6).

## Approved divergences from a prototype

A prototype is the source of truth until a divergence is approved **here**, with its reason. Anything
not listed below is drift, not a decision.

### Lane detail (7b) — one grade at a time, quietly navigable · approved 2026-07-29

`Progression Screens C.dc.html` draws 7b as one scroll listing grade 3, then 4, then 5, headed
"You're at grade 3 here". Three changes, all approved:

1. **One grade at a time.** The screen shows a single grade's units. A grade is not quick to study
   for, and listing five of them implies a pace nobody works at.
2. **The other grades are reachable, not advertised.** No ladder, no chip row — one muted "Other
   grades" line opens a picker, which is the only place the five are ever listed. That picker is also
   where a sparse strand gets an honest answer ("Grade 2 · nothing here yet") instead of an empty
   screen. **R2 is unchanged**: every grade is one tap away and nothing refuses entry. Going above
   your depth says so and offers the way back as the primary action.
3. **The strand is the heading; the grade is the section label.** "You're at grade 3 here" is retired.
   It used one headline slot for two different jobs — a status claim at your depth, a location label
   above it — and it stated a *rank*, when depth is a derived reading that decays (R5). A lane that
   slides back down would make an earned-sounding sentence into a lie. The "where you are" marker
   moves to the section label, where it is a position in a list rather than a claim about the learner.

The depth readout is not repeated here: the lane list (7a) carries it, and every visit passes through
it.

### Lane list (7a) — stripped · approved 2026-07-29

Chosen from six options (`Progression Simplify.dc.html`, option 1e) after the built screen was judged
to over-explain itself. Four things come off, and each was already being said by something that stays:

| removed | what still says it |
|---|---|
| "Where to today, Maya?" | the tab, now titled **Learn** |
| "Seven skills, each at its own depth. Deepen a strong one or repair a short one — nothing is locked." | seven rows, each with a depth bar |
| the mono depth beside every bar ("grade 3", "not started") ×7 | the bar itself — and `accessibilityLabel`, which keeps the words for anyone who cannot see it |
| the full-width "Choose for me" button and its disabled copy | a two-word tag on the one suggested row |

62 words to 1. **The tag is a claim, not a label**: `due` may only appear when the overdue rule fired.
A lane suggested for being shallow says `start here`. With nothing to recommend, no row is tagged and
the screen says nothing rather than saying so in a disabled control.

The lane detail's own copy diet (options 1a–1d) is **not decided** and 7b stands as built.
