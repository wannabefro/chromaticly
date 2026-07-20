// Grade 1 add_time_signature generator (curriculum/exercise-templates.json,
// template_id "add_time_signature"). Renders a single bar of G1 note values
// that sums exactly to one G1 time signature's beat count and asks which
// time signature the bar is in — the same "note tree" arithmetic as
// rhythm_sum, applied to bar identification rather than a bare interval.
//
// The stimulus's `time_sig` is deliberately null (abcjs emits "M:none" and
// omits the signature glyph — see musicToAbc) so the answer isn't printed on
// the stave itself; the learner has to add up the bar to find it.
//
// Distractor strategy: the other renderable time signatures of the SAME
// family (simple/compound, D6) — at grade 1/2 that's always the other two G1
// signatures (provably today's behavior, since every grade-1/2 renderable is
// simple). Each names a different total for the SAME rendered bar, so
// picking one is a genuine miscount — diagnostic, not an arbitrary wrong
// label. The family rule also structurally excludes the 6/8-vs-3/4 equal-
// total ambiguity: equal-total signatures live in different families and
// never co-occur as options.
//
// Grade 3 (D6): the atom grammar `add_time_signature:<sig>` scopes the draw
// to specific signatures (parseAtom yields parts=['6/8'] — '/' is not a
// delimiter). When opts.atoms carries none of these (every grade-1/2 call,
// and any bare grade-3 call), the draw runs over the FULL renderable set,
// unfiltered — grade 1/2's renderable set is the frozen 3-signature simple
// list, so this is byte-identical to the pre-D6 behavior; grade 3 opens all
// six and the compound branch below handles whichever family gets drawn. A
// compound draw builds its bar via bar-math's buildCompoundBarDurations and
// hides the printed signature (time_sig_hidden, D5) while beaming honestly.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Duration, Music, MusicEvent } from '../../music/types';
import { addTimeSignatureAtom, parseAtom } from '../atoms';
import { classifyMetre, isCompoundTimeSignature } from '../metre';
import { mulberry32, pick } from '../rng';
import { diatonicPitchesInRange, renderableTimeSignatures, scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { barUnitsFor, buildBarDurations, buildCompoundBarDurations, type SimpleDuration } from './bar-math';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

type G1Duration = SimpleDuration;

/** The atom-named signatures (add_time_signature:<sig>) that are actually
 *  renderable at `grade`, in atom order, de-duplicated. Empty when `atoms`
 *  carries no parameterized add_time_signature atom — the bare-draw case. */
function timeSignaturesFromAtoms(atoms: string[], grade: number): string[] {
  const renderable = renderableTimeSignatures(grade);
  const sigs: string[] = [];
  for (const atom of atoms) {
    const { kind, parts } = parseAtom(atom);
    if (kind !== 'add_time_signature' || parts.length !== 1) continue;
    const [sig] = parts;
    if (renderable.includes(sig) && !sigs.includes(sig)) sigs.push(sig);
  }
  return sigs;
}

/** D6: the other renderable signatures of the SAME family (simple/compound)
 *  as `timeSig` — always exactly 2 at every grade, since each family has
 *  exactly 3 members across the renderable set. */
function distractorsForFamily(timeSig: string, grade: number): string[] {
  const family = classifyMetre(timeSig).division;
  return renderableTimeSignatures(grade).filter((t) => t !== timeSig && classifyMetre(t).division === family);
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  const scope = scopeForGrade(grade);
  const G1_DURATIONS = scope.noteValues as readonly G1Duration[];
  const atomScoped = timeSignaturesFromAtoms(atoms, grade);
  const timeSignatures = atomScoped.length > 0 ? atomScoped : renderableTimeSignatures(grade);
  const rng = mulberry32(contentSeed);
  const clef = pick(rng, [...scope.clefs]);
  const timeSig = pick(rng, [...timeSignatures]);
  const pitch = pick(rng, diatonicPitchesInRange(clef, grade));
  const compound = isCompoundTimeSignature(timeSig);

  const events: MusicEvent[] = compound
    ? buildCompoundBarDurations(rng, timeSig).map((d): MusicEvent =>
        d.dots === 1
          ? { type: 'note', pitch, dur: d.dur as Duration, dots: d.dots }
          : { type: 'note', pitch, dur: d.dur as Duration },
      )
    : buildBarDurations(rng, barUnitsFor(timeSig), G1_DURATIONS).map(
        (dur): MusicEvent => ({ type: 'note', pitch, dur: dur as Duration }),
      );
  events.push({ type: 'barline', style: 'single' });

  const music: Music = compound
    ? { clef, key_sig: null, time_sig: timeSig, time_sig_hidden: true, voices: [{ events }] }
    : { clef, key_sig: null, time_sig: null, voices: [{ events }] };

  const distractors = distractorsForFamily(timeSig, grade);

  return {
    id: makeInstanceId('add_time_signature', grade, idSeed),
    template_id: 'add_time_signature',
    grade,
    strand: 'rhythm',
    prompt: compound
      ? 'Count the dotted-crotchet beats in this bar. Which time signature is it in?'
      : 'Add up the note values in this bar. Which time signature is it in?',
    stimulus: { music, text: null },
    interaction: { type: 'mcq', config: {} },
    answer: { canonical: timeSig, accepted_alternatives: [] },
    distractors,
    hints: compound
      ? ['Count the dotted-crotchet beats in the bar, then match the total to a compound time signature.']
      : ['Use the note tree to add up the bar, then match the total to a time signature.'],
    feedback: {
      correct: 'Correct!',
      incorrect: compound
        ? 'Not quite — recount the dotted-crotchet beats in the bar and match the total to a compound time signature.'
        : 'Not quite — recount the beats in the bar and match the total to a time signature.',
    },
    srs_tags: [compound ? addTimeSignatureAtom(timeSig) : addTimeSignatureAtom()],
    kb_version: KB_VERSION,
  };
}

export const addTimeSignature: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
