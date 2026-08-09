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
- **The mark is the chromatic C** (approved 2026-08-06 — this line previously read "Do not invent a logo"). Sam's artwork: a ring of chromatic wedges broken at the right, a dark C whose inner arc becomes piano keys, and a quaver at the upper right. Source of truth is `design/brand/logo-source.png`; every icon asset is derived from it by `scripts/export-icon.py design/brand/logo-source.png --bg '#ffffff' --fit 0.80`, never edited by hand. The fit measures **visible** bounds only — the artwork carries a soft shadow reaching 147 px below the mark at alpha 1–8, and counting it centred the shadow instead. The mark is **light-ground** — the C and the quaver are near-black, so it must never be placed on a dark surface. That is why the splash keeps the dark canvas but puts the mark on its own white rounded card. The **iOS 18 dark variant** recolours only that near-black ink to `--paper`, leaving every wedge as drawn, and ships with its transparency intact because iOS supplies the dark backdrop itself. The **tinted** variant is deliberately absent: Expo fills the tinted source with a white background, which flattens grayscale artwork, so iOS derives its own from the light icon instead. **In-app, use the dark variant** — the Welcome screen renders `icon-dark.png` directly, because the app canvas is dark and that file is transparent with light ink. The 7-hue `brandGradient` token it replaced is now unused; keep it for the score rings. Alongside it the brand sets "Chromaticly" in Figtree 800. The wedge palette is the mark's own and deliberately wider than the seven strand hues; do not reconcile them.

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

### Exercise set — item 1 is a try, not a test · approved 2026-07-29

No prototype covers this. The only "just try it" copy in `Chromaticly Core Flows.dc.html` belongs to
the onboarding coached warm-up (3 questions, once, pre-profile), and a lesson had nothing between the
teach card's single worked example and eight scored questions. Chosen from three shapes; the two not
taken are recorded because they remain the alternatives if this one proves too thin.

| shape | why not |
|---|---|
| **A — item 1 is a try** *(taken)* | — |
| C — an answer-first read-only item | needs a new read-only interaction; keep as the next step if A reads as too subtle |
| B — a faded worked example, walked in 3 steps | strongest pedagogy, but needs authored step copy per template, and the steps differ per strand |

What A renders:

1. **Eight items are still presented; seven are scored.** The set length is unchanged, so the seed
   window per play, every pinned snapshot and every Maestro flow hold.
2. **The lead-in segment is dashed**, the same grammar the lane bar uses for a grade that teaches
   nothing — a slot with nothing to earn, not an empty one the learner has yet to reach.
3. **The smart tip is open before the question is read**, in the same 💡 card the teach phase uses,
   and a mono caption says "this one doesn't count — the tip stays open". The tip and the caption are
   one decision: an open tip alone reads as an ordinary hinted item.
4. **It records nothing** — no gem, no mastery, no SRS review. This is a design constraint, not an
   implementation detail: a screen that says an item does not count must not then charge for it.

### Lane bar — a lane that has slid back · approved 2026-07-30

No prototype covers this either. `laneDepths` has produced `decayedFrom` since G6 U2 and nothing
drew it, so a learner whose grade-3 pitch had gone stale saw an honest "grade 1" bar with no trace
of the two grades they earned. R5 requires drift to be honest **and unpunished**, and a silent
rewrite of history is neither.

Drawn **in the bar, not as a fourth tag.** Design 1e gives the row exactly one tag slot and reserves
it for the single suggested lane; several lanes decay at once, so a `slipped` tag would either
compete with `start here` or appear seven times.

The bar therefore has four segment states, and each one answers a different question:

| state | drawn as | means |
|---|---|---|
| `filled` | solid strand hue | held now |
| `slipped` | **hollow — strand hue as a 1px border, no fill** | earned before, gone stale |
| `empty` | solid grey | real content, not yet reached |
| `gap` | dashed ghost | the strand teaches nothing at this grade |

Three constraints this carries:

1. **Hollow is the shape of what was earned, minus the fill.** It is the strand's own hue, never a
   warning colour, and no copy anywhere says "lost".
2. **`slipped` is checked after `filled`.** A lane decayed from 4 to 2 draws 1–2 solid and 3–4
   hollow, so the bar reads as a boundary rather than a single flat span.
3. **The words survive in the accessibility label** — "Scales & Keys, grade 2, was grade 4" — the
   same bargain the 1e copy diet struck for the depth itself.

### Placement result (7c) — the bar, not the number · approved 2026-07-31

`Progression Screens C.dc.html` draws each of the seven depths as a bare numeral. Built as the
five-segment **`LaneRow` bar** instead — the same component the Learn tab (7a) uses, not a lookalike.

The prototype's version is not wrong in isolation; it is wrong *next to 7a*. The screen the learner
sees immediately after this one draws the identical fact as a bar, so a numeral here teaches two
representations of one thing on consecutive screens. Reusing the component also makes R3 ("these
surfaces must never disagree") structural rather than a convention someone has to remember.

The bar carries one thing a number cannot: **the sparse matrix**. Chords teaches nothing below grade
4 and context only exists at grade 1. Drawn as dashed gaps that reads as a skill that starts later;
drawn as the numeral `1` it reads as three grades of failure at material that does not exist.

Four consequences, none of which would justify the change alone:

| | |
|---|---|
| **No depth text beside the bar** | 1e removed it from `LaneRow` and it stays removed. Adding it back here would recreate the disagreement the bar exists to fix. The words survive in `accessibilityLabel`. |
| **Depth 0 reads "not started"** | R7 made 0 real with no floor at 1, so the prototype's "wrong → starts at grade 1" cannot hold. A bare `0` is meaningless. |
| **"Not asked" is a separate line** | A strand the pass never reached is a fact about the PASS, not the learner. `PlacementOutcome` already distinguishes it from a measured 0; naming it in a footnote follows `ReadinessCard`'s "Not examined at this grade" precedent. |
| **The count is derived** | Seven placeable strands, so "Placement · 7 questions", not the prototype's hardcoded eight. It stays true when chords gains a grade-3 lesson. |

**The name goes.** 7c reads "Here's where you are, Maya", but onboarding has no name to use — a
display name is not captured until account creation (6b).

**The tip is rewritten** to say how little was measured ("one question per skill") rather than "a
little of each". A one-item sample is what makes the re-test offer above it useful rather than
decorative.

Not changed: the title, the "Uneven is normal" body, the drift warning's job, "Looks about right",
and the re-test-on-tap behaviour — which stays a real four-question ladder, never a self-assessment
slider.

### Teach worked example — a notation answer stacks · approved 2026-08-01

Screen 4a draws the worked example's options as a compact row of three, and every option in it is a
short text ("3", "2 ✓", "6"). Fifteen lessons answer with **notation** instead — pick the rest, the
key signature, the beamed bar — and those options carry no text at all, because the stave is the
label. The prototype has no case for them.

Kept in the mocked row wherever the options are text. A notated set **stacks**, full width.

Two reasons, and the first is structural:

1. **A stave in a quarter-width box collapses.** `StaticNotation` sizes to its container, so four
   across gave a sliver of paper with no notation in it — the same failure as
   `chromaticly-9c8`, where a zero-width host rendered nothing and read as an abcjs bug.
2. **The exercise already stacks them.** `AnswerOption` draws a notation answer as a full-width
   mini stave, and the worked example's whole job is to show what the next eight questions look
   like. A different arrangement here would teach the wrong shape one screen before it matters.

The cost is a taller card — four staves is roughly one and a half screens on a phone. Accepted:
the teach phase is already a scroll, and an option a learner cannot read is worth no space at all.

The tick stays inline (`B ✓`) beside a text label as drawn, and sits below a stave, which has no
label to sit beside.

### By-ear match card (8c) — a scored set item, not a teach card · approved 2026-08-02

Screen 8c scopes the by-ear card to the **teach phase**: it plays, the learner answers, and nothing
is recorded — no mastery, no SRS. It ships instead as an ordinary **scored member of the exercise
set**, graded like any other item, appended after the eight written ones.

The reason is a consequence of a product decision, not a preference. Hearing a lesson is now part of
having learned it, so a lesson is incomplete until its by-ear item is answered. A phase that records
nothing cannot gate anything — the moment by-ear counts, it has to live where credit is kept.

Two things follow, and both are deliberate:

1. **By-ear credit reaches lane depth and SRS, and never exam readiness.** ABRSM Theory Grades 1–5 is
   a written paper. Readiness answers "would you pass it", so a by-ear atom must not move that number.
   Two honest readings beat one that calls a learner unready for an exam they would pass.
2. **The set grows rather than dilutes.** Eight written items stay eight. A lesson with a by-ear item
   runs to nine.

The cost is that the teach phase keeps a **second, unscored** by-ear mechanism — `TheoryInSound`, in
the two lessons that carry it — so two things called by-ear have different consequences. Accepted as
temporary: its fate is an open question, and nothing here depends on the answer.

The card is not universal: 38 of the 91 lessons carry it and 53 are exempt, for two reasons.

- **22 emit no notation at all** — 14 `term_meaning`, 4 `mode_swap`, 2 `instrument_knowledge`, 1
  `degree_name_id`, 1 `enharmonic_recognition`.
- **31 emit notation but fewer than three single notes.** "Tap where it differs" needs at least three
  positions, or the wrong answers are not honest ones.

Those are exempt rather than forced — the right by-ear question for a terms lesson is one phrase at
two tempos, which is a different card.

### Eleven lessons carry no by-ear item at all · approved 2026-08-05

Stage two adds two more cards, which between them reach 42 of those 53 lessons. The remaining
**11 stay written-only permanently**. This is a decision, not a backlog item, and nothing should
later read the gap as unfinished work.

A by-ear question is honest only when the learner can tell the answers apart by listening. These
cannot, for four separate reasons:

| Lessons | Why no question exists |
|---|---|
| `key-signatures`, `key-signatures-2`, `major-keys-3`, `major-keys-4`, `major-keys-5` | Naming a key from sound alone is absolute pitch, which the product contract already puts out of scope |
| `enharmonics-4` | F♯ and G♭ are the same sound. The question cannot be built at all |
| `instruments-4`, `instruments-5` | Timbre, `arco` and `pizzicato`. The audio path has one soundfont voice |
| `character-3`, `expression-2` | `risoluto` against `energico`, `espressivo` against `grazioso`. A synth cannot separate interpretive synonyms fairly |

The same test applies **per atom**, not only per lesson, because `by_ear_atoms` declares a subset.
Inside the buildable terms lessons, roughly 40 atoms still fail it: `da capo`, `fine` and `repeat
marks` name navigation, and `poco a poco`, `molto`, `sempre`, `assai`, `quasi` are modifiers rather
than sounds.

The 10 are recorded here rather than tracked as a gap.

**Amended 2026-08-09, terms deck moved to the ABRSM 2020 lists (chromaticly-i8e).** Two rows of the
table changed and the decision behind them did not. `piano-directions-5` is deleted: `una corda`,
`ped` and `mano destra` are not on any ABRSM list for grades 1 to 5, so the lesson no longer exists
and the exclusion count falls from 11 to 10. The `character-3` / `expression-2` row keeps its reason
and loses its examples, because `deciso` moved to grade 4 and `giocoso` to grade 3; the pairs named
above are the current ones. The earlier "80 of 91" coverage figure is dropped rather than restated —
the lesson count moved several times before this change and the figure was already stale.

### A by-ear card carries one play control, and it belongs to the question · approved 2026-08-06

On a by-ear item the notation card shows **no play affordance**. The single play control is the
strand-hued `Listen` button beside the answer area, and it sounds the **heard** performance.

Device capture on 2026-08-05 found two. The card's own affordance sounded the written music and the
`Listen` button sounded the heard music, so a learner could play both and compare sound with sound.
That answers "does what you hear match what is written?" without reading the notation, which is the
whole question. No unit test caught it — both controls were individually correct.

This reads as an exception to rule 2 (*every notation display carries a play affordance*) and is
not one. The affordance moved; it did not go. Screen 8c, the design's own by-ear card, already draws
exactly one play control, sitting beside the answer area rather than on a stave. The scored cards
now match it.

Two things stay unchanged, and both are deliberate:

1. **Every written item keeps its card play affordance.** The rule is untouched everywhere the
   notation is the thing under test rather than the thing being compared against.
2. **The reveal keeps its play.** The correct-answer notation inside the FeedbackSheet sounds
   normally, per rule 5. The written music becomes playable the moment the answer is in — which is
   the teaching moment, not the exam.

### Welcome offers no sign-in · approved 2026-08-06

Screen 6a draws three sign-in buttons under an "or sign in to sync" divider, framed as secondary.
They shipped **disabled and labelled "Coming soon"**, because nothing in the app syncs. They are now
removed, and 6a is superseded on this point.

The reason is that the buttons advertised a capability that does not exist. A first-time tester meets
them in the first fifteen seconds, taps one, and nothing happens. "Coming soon" does not repair that —
it confirms the screen is unfinished at the moment the app is making its only first impression.

What stays, and why it is not the same thing:

| Surface | Verdict |
|---|---|
| `AccountCreateScreen` | **Stays.** It claims a display name and nothing else — no email, no OAuth, no sync promise. A local identity is honest on a device-only app |
| `AccountNudgeSheet` | **Stays.** It already carries no "sync now" promise and no committed future-sync claim |
| Welcome sign-in block | **Removed.** The only surface that promised a server |

The subtext under the primary button changes from "No account needed — jump straight in." to
"No account needed. Everything stays on this device." — the same reassurance, now also a true
statement of where progress lives. Restore the block only when sync actually exists.

### First steps sits above the grade ladder, not inside it · approved 2026-08-06

Screen 5a draws exactly five cards and `design/` has no screen for a sixth. First steps is a real
level with no exam paper, no exam gate, and no contribution to exam readiness, so where it appears on
the picker is a decision the prototype cannot settle. Chosen from three shapes; the two not taken are
recorded because each wins something this one has to pay for.

| shape | why not |
|---|---|
| **B — a lead-in card above the ladder** *(taken)* | — |
| A — a sixth card, first in the stack | Five siblings are numbered rungs of one ladder. Sixth-in-kind, first-in-order asserts it IS the grade below Grade 1, and the missing numeral reads as an omission rather than a category |
| C — below the five, grouped with the placement quiz | The truest grouping on paper — both answer "I don't know my grade" — but it is ordered last. The reader who needs it most scans five cards that all look plausible, stops at "Grade 1 · the basics", and bounces. That is the failure the level exists to prevent |

Discoverability and category-honesty pull in opposite directions, and B is the only shape that pays
both. What it renders:

1. **The card is set apart by treatment, not by the accent.** Hero radius (`--radius-card-lg`), the
   signature staff-line motif at 3.5%, and `--border-strong`. The accent is not spent here, so violet
   still means *selected* and the screen keeps exactly one accent (rule: one accent per screen).
   A 𝄞 glyph badge was drawn and then **removed on device capture**: it narrowed the text column
   enough to wrap the descriptor onto a third line, which made the lead-in card two and a half times
   the height of the five below it — far more emphasis than the ruling intends.
2. **One mono group label — "or pick your grade" — carries the whole distinction.** The same grammar
   the lane list uses. No second heading, no tab, no segmented control.
3. **The descriptor states "no exam".** It is the structural fact that separates this level from the
   five, and the picker is the last screen where a learner can act on it.
4. **Grade 1 stays the default selection.** First steps is read first but is not preselected. A
   default that drops every tap-through learner into the beginner level is worse than one that misses
   a beginner, and 5a already put the default at the modal answer.
5. **The primary button reads the level title, never the grade number.** `Start Grade 0` would print
   the words the naming decision forbids, so the button reads "Start First steps" here and
   "Start Grade N" everywhere else.

**The plan screen's third card is replaced, not removed.** `PlanScreen` sold "a real practice exam"
to every level. First steps has no paper, and dropping the card left a visible hole that reads as an
unfinished screen rather than a deliberate one (device capture, 2026-08-06). It gets its own third
card instead — "Then Grade 1 · No exam here — when these five are done, Grade 1 picks up right where
they leave off" — which answers the question a beginner actually has about a level that ends without
an exam. The choice is driven by `examGate`, never by `grade === 0`, so a level that later gains a
paper gets the right card without anyone remembering.

**Neither the plan screen nor the Learn tab prints a grade number for this level.** Both read
`Level.title`, which is right for the five as well — "Grade 0" appears nowhere.

**The headline reverts to 5a's "Where should we start?".** The built screen had drifted to "Do you
know your grade?", which asks the one reader First steps exists for to admit they do not — on the
screen that now carries their answer.

### The Learn tab at grade 0 is a chain, not a lane · approved 2026-08-06

A council review found the level unreachable: the picker offered First steps, the profile stored it,
and no mounted screen could open the five lessons. `AppShell` routes the Learn tab through
`LanesScreen`/`LaneScreen`, both of which resolve their grade through `lane-depth.ts`'s `MATRIX` —
which `LANE_FLOOR_GRADE = 1` deliberately excludes grade 0 from. The firewall that keeps First steps
out of exam readiness was also, silently, keeping it out of navigation.

**First steps gets its own screen.** At grade 0 the Learn tab renders `FirstStepsScreen`: the five
lessons in their authored `unlocks` order, tapped to open, with a count instead of a depth bar.

Lowering the floor was the smaller diff and is the wrong fix, for two separate reasons:

1. **It splits one guard into three.** The floor is a single line at the single map that readiness,
   the placement ladder and the radar all read. Moving it into those three derivations restores
   exactly the fragility it was written to remove.
2. **The seven-lane model asks a question a beginner cannot answer.** 7a is "which of my skills is
   shallow?" — a reading for someone who has depths. First steps is one linear chain with no exam, no
   depth and no strand story, so it gets a linear screen. Its lessons still carry strands, and the
   rows still draw the strand overline, because that vocabulary is what the rest of the app uses.

Two exits, and they are the same door:

| state | what it draws |
|---|---|
| unfinished | a quiet "Already know this? Go straight to Grade 1" line |
| all five done | a hand-off card, with `Start Grade 1` as the primary action |

The skip is not a courtesy. R2 says entry is never withdrawn, and someone who over-estimated how
little they knew must be able to leave without finishing and without being asked why. Advancing is
`setGrade(1)`, which is what makes the Learn tab fall back to the seven lanes — there is no second
mechanism.

**`LevelMapScreen` is not the answer and was not used.** It is dead code from the retired
pre-lane spine, referenced only by its own test.

### The coached warm-up drills the level you chose · approved 2026-08-06

Screens 4–5 draw the warm-up as a notated "which note lasts longer?" item, and D11 pinned it to
grade 1 for every learner on the grounds that the warm-up runs before a profile exists. It now
branches on the chosen level, and at grade 0 it drills the musical alphabet instead.

A First steps learner is, by construction, someone who has never read music. Retry-until-correct
(KTD3b) re-presents the same item until it is answered correctly — which turns a question they
cannot read into a wall they brute-force until they guess, on the first screen the app ever asks
them anything. Rewording it does not help, because the wall is the mechanic, not the copy.

`alphabet:G` needs no notation and no audio. G is chosen over the other six letters because its two
questions are the wrap ("after G" → A, the fact lesson 2 exists for) and an ordinary step
("before G" → F).

Three things follow, and all three are the same decision:

1. **One definition, in `src/learn/warm-up.ts`.** The generator call, the recorded atom, the screen
   accent, PlanScreen's name for it and LandedScreen's "your first *strand* point" all read it.
   Before this they were five literals in three files, and one was already wrong.
2. **The accent follows the atom.** The warm-up is a pitch item at grade 0, so the hue and the strand
   label follow — one accent per screen, and it must be the screen's own.
3. **The "tap play" coach mark is withheld when the item has no notation**, because there is then no
   play control for it to point at.

D11's premise is retired: `RootRouter` holds the chosen grade in state and already hands it to
`PlanScreen` one screen earlier, so "before any profile exists" was never the same as "before the
grade is known".

**The grade 1–5 warm-up moved too, for the same reason** (`chromaticly-atz`, fixed 2026-08-06).
It drilled `note_value_compare`, which is grade-1 *scope* but is the sole atom of `rhythm-breve-4`, a
**grade 4** lesson. Retry-until-correct guarantees mastery of the warm-up atom, so every new learner
arrived with that grade-4 lesson fully three-starred and with real evidence toward grade-4 rhythm
readiness. D11 asked whether the atom was legal at grade 1 and never asked which lesson owned it.

It now drills **`add_time_signature`**, from `note-values` — the grade-1 lesson this warm-up has
always been *named* after. Chosen over that lesson's other two atoms because it alone keeps the shape
screens 4–5 draw: `rhythm_sum` renders no stimulus notation, so the play affordance and its "tap play"
coach mark would point at nothing, and `bar_validity` answers with a row of ticks rather than one
choice. It also varies where the old one did not — three seeds give 3/4, 4/4 and 2/4, against one
repeated prompt before.

**The three seeds are authored, not 0,1,2.** Seeds 0, 1 and 2 all draw the **bass** clef, so the
first three staves the app ever showed a grade-1 learner used the clef they meet in lesson 3
(`bass-notes`), not lesson 1 (`treble-notes`). The question is purely rhythmic, which is exactly why
the clef must not be the odd thing about it. Seeds 3, 5 and 6 are treble, and answer 3/4, 2/4 and 4/4
rather than repeating — retry-until-correct already re-presents an item, and three identical answers
on top of that is a pattern a learner can ride without reading the question.

**The rules this leaves behind**, all asserted per grade in `src/learn/warm-up.test.ts`: a warm-up
may only credit a lesson at the learner's own level; it may never credit a single-atom lesson,
because mastering the one atom completes it outright; and its notation must use the clef its level
teaches first.

### The grade cards are numbered, in one accent · approved 2026-08-06

Screen 5a draws a 34pt numeral badge on each of the five grade cards and gives each badge its **own
hue** — `#f0949b`, `#f0c489`, `#cb7ad4`, `#7fcaea`, `#dca6e2`. The built screen had no badges at all.
Both are wrong, and the prototype cannot simply be followed here, because those five hues break the
one-accent rule and none of them is the strand colour of anything. They encode nothing.

**The numerals return, in a neutral tint, and the accent marks only the chosen card.** The numeral
identifies the rung; the colour states the selection. Two jobs, two devices, neither competing with
the other — where 5a spends the screen's single accent five times and then needs the border and the
tick to say which card is actually selected.

This is not the lane list's exception restated. That one carries seven hues because the screen *is*
the radar and no single strand can be current, and every hue there names a strand. Here the colours
name nothing, so there is no sentence to write in their defence.

**It also makes the First steps ruling visible rather than merely true.** The argument for putting
First steps above the ladder was that a sixth numeral would assert it is the grade below Grade 1.
Numbering the five and leaving it unnumbered is that argument, drawn: they are rungs, it is not.
`GradeSelectScreen.test.tsx` asserts the absence, so a later edit that gives it a badge goes red.

Not changed: the badge geometry. 34pt at radius 10, exactly as 5a states it.

### tap_placement — adding bar-lines · approved 2026-08-08

`Chromaticly Core Flows.dc.html` has no screen for `add_barlines`, which
`curriculum/exercise-templates.json` has specced since the first grade-1 pass. The card is new,
and it reuses the existing contracts rather than adding to them:

1. **The stimulus is a NotationCard**, unchanged — paper, play affordance, SVG overlay children.
   The tap zones and the placed bar-lines are overlay children, which the contract already allows.
2. **A placed bar-line is the strand hue**, never ink, so what the learner added never reads as
   part of the printed rhythm.
3. **Marking uses `--correct` / `--incorrect` on the paper**, not the strand hue. It is the one
   place the paper carries a semantic colour, and it is needed because "mine" and "right" must not
   share one.
4. **The tap zones tile** with no dead space, each at least 44px wide, and a tap snaps the line to
   the zone centre rather than the finger position.
5. **A placed bar-line is removed by tapping it again.** Drag needs a gesture the app uses nowhere
   else, and an undo control would compete with Check.
6. **The gaps show at rest** as faint `--paper-slot` guides, the same token `stave_input` uses for
   ghost noteheads. Without them a tap on a notehead reads as a broken screen rather than a miss.
7. **A wrong answer marks the learner's own lines**, struck through, alongside the missing one.
   Principle 4 is that wrong answers teach, and printing the right answer alone leaves the learner
   to diff two pictures from memory.

**Built in two stages; both have landed.** Stage 1 put the tap zones in the answer card below the
stave. Stage 2 moved them into the paper, which is the card as drawn: `setGapMode` tiles transparent
zones between consecutive notes, a tap emits `gapTapped`, and `setBarlines` draws the placed lines
and the marking. The zones are our own rects rather than abcjs's `clickListener`, because that
hit-tests a tap to a NOTE and can never report the space between two. Gap mode is off by default —
the zones sit above the notes, so no other template may have them.

**The strip below the stave stays.** It is the guaranteed path, exactly as `find_the_bar` keeps its
bar strip: a 44px zone inside a WebView is not a target every learner will hit, and the strip also
carries the placed count and works with a screen reader.

The rejected alternative is recorded there too: an mcq that labels candidate positions and asks
where the FIRST bar-line goes. It ships without a design decision, and it asks for one bar-line
rather than the rhythm.

### The scales grew rather than the screens drifting · approved 2026-08-08

Measured on 2026-08-08: the code used 20 distinct spacing values against the 3
`shape.css` defined, and 20 type sizes against 6. Sam ruled: unify on the tokens,
and add a token only where one is essential. Five spacing tokens and a glyph
scale were added, and every spacing literal now reads from `shape`.

1. **The rhythm below `--space-inline` is 4px** — `--space-snug` 8, `--space-tight`
   4. `--space-hairline` 2 is narrower than a rhythm step on purpose: it is the
   gap **inside one text block**, a label over its value, never between two things.
2. **Two screen insets are named for their role**, not their number:
   `--space-screen-top` 48 (onboarding containers) and `--space-screen-bottom` 24.
3. **Notation and icon glyphs left the type scale.** A clef, a notehead, a
   duration glyph and a chevron are drawn shapes, so sizing them on a text scale
   was a category error. They now read `--glyph-sm|md|lg|xl|xxl` (14/18/22/28/32).
4. **`--text-caption` 12** fills the step between `--text-label` 11 and
   `--text-body` 14, which 17 uses had been inventing. `--text-display` 44 is the
   exam mark, the one number a screen is entirely about.
5. **Radii below `--radius-control` stay untokenised, deliberately.** Every one of
   them is notation geometry — a notehead, a ghost slot, a dot, a rule — whose
   corner follows the shape's own size. A token would be false precision. Only
   chrome takes a radius token.

No fold moves a value by more than 2px, with one stated exception: three
`paddingBottom` values on scrolling containers (30, 32) fold to
`--space-screen-bottom` 24.


### Placement replaced the grade ladder, so two 2026-08-06 rulings lose their subject · approved 2026-08-09

R1 landed: onboarding measures seven strand depths instead of asking for one grade
(design 7c and A1/A2). `GradeSelectScreen` is no longer the setup question — it is
the destination of placement's "Skip — start from the beginning", and it offers two
starting points, not five rungs.

Two earlier rulings on this page describe cards that no longer exist. Neither is
overturned; both are preserved by construction, and this note records why they
stop being enforceable rather than letting them read as silently ignored.

1. **"First steps sits above the grade ladder, not inside it"** (2026-08-06) — there
   is no ladder left to sit inside. First steps now leads a two-item choice and is
   preselected, because "the beginning" is the alphabet and the stave, not Grade 1.
2. **"The grade cards are numbered, in one accent"** (2026-08-06) — the numerals
   went with the rungs they identified. The accent still means "selected", and it
   still appears exactly once per screen.

Grade 1 stays as the second choice. A learner who reads music but declined to be
measured is not a First-steps learner, and placement's own copy would be a lie if
skipping had only one outcome.
