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
- **Color:** near-black blue-grey surfaces (`#0b0c0f/#111318/#1a1d24`), 7-strand chromatic accents (see tokens/colors.css). One accent per screen — the current strand's hue drives the progress bar, selected states, and primary button. Strand color is ALWAYS paired with a glyph or label (colour-vision safety).
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
- `components/core/` — Button, AnswerOption, NotationCard, PlayButton, StrandChip, ProgressSegments, MasteryGems, FeedbackSheet (+ .d.ts, .prompt.md each)
- `guidelines/` — foundation specimen cards (@dsCard)
- `Chromaticly Core Flows.dc.html` — all screens: exercise loop (2a–2f), SRS (2g–2h), level map + exam (3a–3d), lessons + context + light mode (4a–4e), onboarding/profile/interaction states (5a–…)
- `SKILL.md` — agent skill entry point

## Intentional additions
- `NotationCard` — placeholder contract for the real abcjs/VexFlow renderer (required by brief §6).
