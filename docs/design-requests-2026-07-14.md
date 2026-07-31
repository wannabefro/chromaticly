# Chromaticly — design requests

**From:** engineering
**Date:** 14 July 2026
**Context:** The Grade 1 slice is functionally complete and running on device. In seven
places the build ran past the end of the design. In three of those we shipped an
invention because there was no mock to follow — those are live in the app now, and they
need either your drawing or your blessing. The rest are drawn controls with no
destination, plus one decision.

Everything references the screen tags in `Chromaticly Core Flows.dc.html`.

Two constraints that shape all of it:
- **Assessment mode is a different product.** No hints, no streaks, no XP, no
  celebration, no correctness shown mid-paper. Warm paper, Source Serif 4.
- **Notation never inverts and is never cropped.** It renders on `--paper` in every
  mode, and every notation display carries a play affordance.

---

## A. We invented these. They're live. Please draw them or bless them.

### A1. Exam — the flagged-review screen  *(highest priority)*

**What exists:** 3c draws a `⚑ flag` button on every exam question. The caption says
"flag-for-review before submit."

**What's missing:** where a flag *leads*. No screen shows what happens at the end of the
paper when questions are flagged.

**What we shipped, with no precedent to follow:** finishing the paper with anything
flagged now routes to a screen reading *"You flagged 3 questions."* with
`Review flagged (3)` (primary) and `Submit paper` (secondary). Tapping review jumps back
to the first flagged question with the clock still running.

**What we need:** this screen, or a decision that the stand-in stands. It's the moment
right before a learner submits a paper — the most consequential screen in the app — and
it currently has no design behind it. Worth knowing: a flag that leads nowhere would be
a control that does nothing, which is why we couldn't just leave it out.

### A2. Teach — the "theory in sound" by-ear card

**What exists:** 4b shows the card with the waveform **already revealed** — tall bars
pre-drawn at the strong beats, no tap targets. It reads as a specimen of the finished
state.

**The conflict:** the card's whole point is that the learner finds the strong beats *by
ear*. Drawing them upfront hands over the answer before they listen.

**What we shipped:** beats start as uniform cells; tapping a strong beat grows it into
the tall waveform bar from your mock. So the design's picture is our *end* state.

**What we need:** the states you never drew — the resting/in-progress state, the tap
targets themselves, wrong-tap styling, and the completion message. Or a ruling that our
reading is right and the shipped behaviour stands.

### A3. Stave input — the duration palette is specced 3-wide, Grade 1 needs 4

**What exists:** 2d lays out three duration buttons (crotchet, minim, quaver) + undo,
sized for a three-across row.

**The problem:** Grade 1 includes **semibreve**, so we render four buttons in a row built
for three. The labels break mid-word on device — "semibr eve", "crotch et", "semiqu
aver". It looks broken, because it is.

**What we need:** a four-across layout, abbreviated labels, or glyph-only buttons. Also
worth checking: the accidental picker (♯) is currently clipped off the right edge of the
stave — the stave bleeds edge-to-edge, which breaks the never-crop rule.

---

## B. Drawn controls with nowhere to go.

### B1. Exam results — the "Review paper" button

3d shows **Review paper** as the primary CTA. There is no screen behind it — nothing in
the design shows a learner walking back through a completed, graded paper. We've wired
only "Back to Learn".

**Needed:** the per-question review view. Note this is a *different* screen from A1: A1
is pre-submit (revisit what you flagged, nothing graded yet, clock running); this is
post-results (walk the graded paper, correctness now visible).

### B2. Music in Context — the composite passage

4c specifies one score pinned to the top with several sub-questions over it ("Q3 / 5").
The interaction is designed; the *runner* isn't. What ships today is a single
find-the-bar question that generates a fresh score each time, so the score never persists
across questions and the "Q3 / 5" counter has nothing to count.

**Needed:** how the passage behaves across sub-questions — does the score stay pinned and
the question area swap beneath it? What are the sub-question types (find-the-bar,
highest/lowest, degree-of-note, term-in-context)? Is it graded as one item or several?

---

## C. One decision. No drawing needed.

`README.md` states the rule: *"Numbers users scan (marks, counters, %, timers) are always
mono."* Screen **3d sets the exam total in Source Serif 4** ("61 / 75"). Screen 3c's live
mark counter *is* mono, as the rule says.

The code follows the screen (serif on the results total). Until you rule, the rule can't
be applied consistently — every new number is a coin flip.

**Which wins: the README rule, or 3d?**

---

## D. FYI — borrowed, not invented

Grade 1's per-bar true/false input (tick/cross on each bar) has no Grade 1 mockup; we
derived it from board card **5h**, which is tagged Grade 5 scope. It looks right and
follows the pattern, but nothing specifies it for Grade 1. Flagging in case that's wrong.

---

## Not on your plate

These are designed, unambiguous, and simply not built yet — implementation backlog, not
design gaps. No designer time needed: nav tab shell, Profile & settings (5c), 7-strand
mastery radar, save-progress nudge (6c), account creation / age gate (6b), placement quiz
(5b), light-mode register (4d/4e).
