# Exercise Construction Spec
### Format, rules and material for generating ABRSM-aligned theory exercises (Grades 1–5)

Companion files:
- **`knowledge-base.json`** — the *material*: what's in scope at each grade (keys, clefs, time signatures, ranges…) plus canonical theory data (key-signature orders, scale patterns, beaming rules).
- **`exercise-templates.json`** — the *rules*: 19 parameterised templates covering every exercise format in the workbooks, each with generation constraints, distractor rules and grading logic. Includes the exercise-instance schema.
- **`terms-signs-deck.json`** — the vocabulary *material* for the Terms & Signs strand (Grade 1 transcribed and verified from the workbook; Grades 2–5 seeded, flagged for verification).

---

## 1. The pipeline

```
knowledge-base (grade scope)          template (rules)
        \                                 /
         → GENERATOR → candidate exercise → VALIDATOR → RENDERER → learner
                              ↑                  |
                        seed/params        reject & regenerate
```

Every exercise is **generated, not authored**: a template + a grade scope + a random seed deterministically produces an exercise instance. This gives unlimited practice items, guarantees we never reproduce ABRSM's copyrighted exercises (we borrow their *formats*, which is the point of this spec), and makes every item reproducible from `(template_id, grade, seed)` for debugging and analytics.

## 2. Music representation format

Canonical model is JSON; renderers translate it to notation. Recommended render path: emit **ABC notation** and render with `abcjs` in-app (lightweight, handles all four clefs, key signatures, beaming, ornaments, multi-stave); VexFlow is the fallback if you need finer engraving control or interactive note-editing surfaces.

```json
{
  "clef": "treble | bass | alto | tenor",
  "key_sig": "Eb_major | C#_minor | null (accidentals written in)",
  "time_sig": "6/8 | null",
  "anacrusis": false,
  "voices": [ { "events": [
      {"type": "note", "pitch": "F#4", "dur": "quaver", "dots": 0,
       "tie": false, "beam_group": 3, "tuplet": {"n": 3, "in": 2},
       "articulation": ["staccato"], "ornament": null, "dynamic_at": "mf"},
      {"type": "rest", "dur": "crotchet", "dots": 0},
      {"type": "barline", "style": "single | double | repeat_start | repeat_end"}
  ] } ],
  "text_annotations": [{"at_event": 0, "text": "Allegro", "position": "above"}]
}
```

Rules: pitch = scientific pitch notation (`C4` = middle C). Accidentals are implied by pitch spelling plus `key_sig` — the renderer computes what to print (this is essential for correctly grading transposition and scale-writing answers). `beam_group` ids group beamed notes explicitly, because beaming *is content* in this curriculum, not a rendering nicety. Multi-voice/multi-stave (Grade 5 piano textures) = multiple `voices` with a `staff` field.

## 3. Exercise instance format

Defined fully in `exercise-templates.json → exercise_instance_schema`. The essentials: every instance carries `template_id / grade / strand / seed` (provenance), a `stimulus` (Music object and/or text), an `interaction` type, an `answer` block with **canonical answer + accepted alternatives**, `hints` (the app equivalent of the books' Smart Tips — progressive reveal, hint use discounts mastery), and `srs_tags` — fine-grained skill atoms (`key_sig:Eb_major`, `note_read:tenor:ledger_above`, `term:sotto_voce`) that drive spaced repetition and weakness targeting.

## 4. Stimulus content strategy: three tiers

Not all stimuli should be produced the same way. Each template declares its tier.

| Tier | Content | Method | Share of items |
|---|---|---|---|
| **A** | Atomic exercises (note naming, key signatures, scales, intervals, triads, rhythm sums, bar validity) | **Fully generate** — combinatorial, deterministic correctness | ~70% |
| **B** | Phrase-level exercises (barlines, regrouping, transposition, cadence boxes, G1–3 Music in Context) | **Transform curated seed phrases** | ~25% |
| **C** | G4–5 Music in Context on real textures (piano two-stave; violin + piano) | **Curate public-domain excerpts**; generate only the questions | ~5% |

### 4.1 Tier A — pure generation
Stimuli of 1–4 bars built directly from the knowledge base (stack a triad, spell a scale, place a note). No musicality requirement beyond notational correctness; the validator (§6) is a complete quality gate.

### 4.2 Tier B — the seed bank + transformation engine

**Why:** randomly generated melodies validate correctly but often sound aimless, and audio playback is this app's main advantage over the paper books. A small bank of genuinely musical phrases, multiplied by syllabus-relevant transformations, gives musical quality at generative scale: ~300 seeds × transformations ≈ tens of thousands of distinct, guaranteed-musical exercises.

**Seed phrase format** (extends the Music object in §2):

```json
{
  "seed_id": "seed_0042",
  "source": "original | folk:pd | llm_draft",
  "review": {"musicality_approved": true, "reviewer": "…", "date": "…"},
  "music": { "…Music object: 2-8 bars, single line…" },
  "native": {"key": "G_major", "clef": "treble", "time_sig": "3/4", "range": "D4-E5"},
  "properties_index": {
    "melodic_intervals": ["M2","m3","P4","…"],
    "chord_tone_map": [{"bar": 4, "beat": 1, "fits_chords": ["I","IV"]}],
    "cadence_ready": {"final_two_notes_support": ["perfect"]},
    "rhythm_atoms": ["dotted_crotchet", "quaver_pair"],
    "min_grade": 1
  },
  "transform_constraints": {
    "transposable_keys": "any in grade scope within playable range",
    "clefs_allowed": ["treble", "bass", "alto", "tenor"],
    "compound_time_rewrite": true
  }
}
```

The `properties_index` is precomputed once per seed so the exercise generator can query "give me a seed whose final two notes support a plagal cadence in F major" in O(1). Seeds may be hand-written, adapted from public-domain folk tunes (a huge free corpus of exactly this kind of 4–8 bar melody), or LLM-drafted — provenance is recorded, and **every seed passes the deterministic validator plus a one-time human musicality review** before entering the bank.

**Transformation catalog** (each transformation is itself a syllabus skill, so transformed seeds are pedagogically native, not just recycled):

| Transformation | Parameters | Grade gate | Used by templates |
|---|---|---|---|
| `transpose_key` | any grade-scope key, respell accidentals | 1+ | all Tier B |
| `swap_clef` | treble↔bass (3), +alto (4), +tenor (5), with octave shift | 3+ | note reading, transposition |
| `shift_octave` | ±1 octave within range policy | 1+ | ledger-line practice |
| `strip_barlines` | remove internal barlines (keep beaming) | 1+ | `add_barlines` |
| `strip_time_signature` | remove signature, keep grouping | 1+ | `add_time_signature` |
| `corrupt_beaming` | rewrite with wrong/absent beams | 1+ | `regroup_rebeam` |
| `excise_rests` | delete rest(s), mark gap | 1+ | `rest_completion` |
| `rewrite_metre` | simple↔compound equivalent (3/4↔9/8 etc.) | 5 (learner task) / 3+ (stimulus prep) | rhythm rewriting |
| `add_anacrusis` | shift phrase onto an upbeat | 3+ | barline/metre tasks |
| `inject_triplet/duplet` | replace a beat's contents | 2+ / 4+ | rhythm variety |
| `mode_swap` | relative or tonic major↔minor with correct inflections | 2+ | minor-key practice |
| `decorate` | add grade-scope dynamics/articulation/terms/ornaments, recorded as queryable atoms | 1+ | `music_in_context` |
| `transpose_interval` | ±M2, m3, P5 incl. new key signature | 5 (learner task) | `interval_transposition` |
| `instrument_frame` | present as written/sounding pitch for B♭/A/F instrument | 5 | transposing instruments |
| `mark_cadence_boxes` | attach Roman-numeral boxes at chord-tone points from `chord_tone_map` | 5 | `cadence_and_chord_choice` |

Composition rules: transformations chain (e.g. `transpose_key → swap_clef → strip_barlines`); the chain is recorded in the exercise instance for reproducibility; the validator re-runs after every chain; and a seed-novelty window prevents a learner meeting the same seed twice in close succession even under different transformations.

### 4.3 Tier C — curated repertoire corpus
For G4–5 Music in Context, pre-encode a corpus of short public-domain excerpts (composer dead >70 years, our own encoding) covering the textures the workbook uses: solo piano two-stave, violin + piano, plus short orchestral-instrument lines for the instrument questions. Question sets are then generated programmatically over the fixed score exactly as in the `music_in_context` template — the score is curated, the questions are dynamic and verified against the encoding.

### 4.4 Quality feedback loop
Every instance is reproducible from `(template, grade, seed/seed_id, transform_chain, rng_seed)`. Ship a "report this exercise" control; reports resolve to a specific seed or transform chain, which can be killed or fixed server-side. The bank improves monotonically over time.

## 5. Generation rules — the ten commandments

1. **Scope is law.** Every pitch, value, key, signature, term and clef must come from the cumulative grade scope in `knowledge-base.json`. A single out-of-scope element = validator rejection.
2. **Weight the new.** ~50% of items in a lesson exercise the lesson's new material; the rest is spaced review drawn from SRS-due atoms of earlier lessons/grades.
3. **Distractors must be diagnostic.** Each distractor encodes a *known misconception* (clef confusion, relative-key confusion, misplaced key-signature accidental, off-by-one interval, wrong-inversion letter). Templates list their distractor rules; never pad with random wrong answers.
4. **One unambiguous answer** for closed items — the validator must prove no distractor is also defensible (e.g. a bar that fits both 3/4 and 6/8 is only allowed when beaming disambiguates, which is itself the G3 teaching point).
5. **Accept all legitimate alternatives** for open items: alternative beamings, alternative rest decompositions, enharmonic answers where the question doesn't pin spelling, any valid chord in a cadence box that doesn't break the named cadence. The `accepted_alternatives` list is computed, not hand-listed.
6. **Grading explains, not just scores.** Every wrong answer maps to feedback naming the misconception its distractor encodes ("That's what this note would be called in the treble clef — check the clef sign").
7. **Never emit the books' content.** Formats, rules and vocabulary lists (factual data) — yes. Their melodies, exercises and prose — never. The generator makes this structural, but keep it as a validator assertion too (hash-check against any encoded book excerpts used during QA).
8. **Everything sounds.** Every stimulus ships with synthesized audio (the Music object is sufficient input). Terms deck items get audio exemplars (a phrase played *staccato* vs *legato*).
9. **Deterministic from seed.** Same `(template, grade, seed)` → same exercise, forever. Version the knowledge base so old seeds stay reproducible.
10. **Exam-format fidelity at the gates.** Level assessments must instantiate the practice-paper section structure and its question wording register ("Tick one box…", "Circle TRUE or FALSE") with a 75-mark budget, so passing Level 5 genuinely predicts real Grade 5 exam readiness.

## 6. Validator checklist (run on every generated item)

- Bars sum exactly to the time signature (anacrusis rule where applicable)
- Beaming/rest decomposition legal per knowledge-base rules; rest stave-placement correct
- Pitch spellings consistent with key signature; accidentals cancel correctly within bars
- All content within cumulative grade scope
- Closed items: exactly one defensible answer; distractors all provably wrong
- Open items: `accepted_alternatives` fully enumerated by the checker, not sampled
- Stimulus renders (ABC compiles) and synthesizes without error
- Item hash not seen recently by this learner (novelty window)

## 7. Difficulty within a grade

Three dials per template, so lessons can ramp: **material recency** (old vs new atoms), **presentation** (with key signature → with accidentals; treble → the grade's new clef; MCQ → free construction), and **span** (1 bar → 4 bars; single question → composite flow). Map dial positions to the lesson sequence in the curriculum doc — early exercises in a lesson mirror the books' pattern of a worked example (show one pre-solved, as the books do in orange) followed by progressive variation.

## 8. Coverage map

Every workbook exercise format → template: tick-boxes/circle → `*_mcq` modes; note naming/spelling words → `note_naming`; musical sums → `rhythm_sum`; tick/cross bars → `bar_validity`; add barlines/time signature → `add_barlines`, `add_time_signature`; regroup → `regroup_rebeam`; rests → `rest_completion`; key signatures → `key_signature_id`; scales incl. spot-the-error and semitone-marking → `scale_construction`; degrees → `degree_identification`; intervals incl. write-the-note → `interval_naming`; triads/chords/inversions/grid method → `triad_chord_tasks`; octave & interval transposition incl. transposing instruments → `octave_transposition`, `interval_transposition`; Roman-numeral boxes & cadences → `cadence_and_chord_choice`; terms/matching → `term_meaning`; ornaments incl. G5 written-out→sign → `ornament_tasks`; instruments/voices → `instrument_knowledge`; score study → `music_in_context` (composite). "Challenge!" and "Theory in sound" are delivery modes (stretch flag; audio-first variant) on existing templates rather than separate templates.

## 9. Build order recommendation

1. Music model + ABC renderer + audio synth (everything depends on it)
2. Tier A generators: `note_naming`, `rhythm_sum`, `term_meaning` (no seeds needed — ship a playable Grade 1 slice fast)
3. Validator + transformation engine + an initial ~50-seed bank (enough for the G1 barline/regrouping family)
4. Scales/keys/intervals/triads family (pure knowledge-base computation)
5. Grow the seed bank to ~300 with `properties_index` coverage for cadence and transposition needs; build the G3–5 transformation set
6. Tier C corpus + `music_in_context` composite + level assessments (needs everything above)

## 10. Known gaps to close before content-freeze

- Verify Grade 2–5 term lists against workbook chapters (deck entries flagged `verified: false`)
- Confirm the exact Grade 4 new-time-signature set from workbook ch. 2 (OCR was unreliable)
- Decide UK/US terminology toggle depth (labels only vs. full prompt re-wording — the note-name equivalence table is already in the knowledge base)
- Build the seed bank (~300 phrases: original + public-domain folk + reviewed LLM drafts) and the Tier C public-domain repertoire corpus
- Define the human musicality-review workflow and the "report this exercise" kill-switch pipeline
