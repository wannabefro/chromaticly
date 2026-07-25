// Grade 5 satb_voice_recognition generator (G5-1 recognition-first slice,
// design G5-1) — a braced treble+bass grand staff carrying a root-position,
// root-doubled 4-part triad (S=treble stem-up, A=treble stem-down, T=bass
// stem-up, B=bass stem-down; no tenor clef, see the plan's deferral). One
// voice's note is marked `highlight:true`; the learner names which voice
// sings it from the four-option `voice_options` interaction.
//
// KTD5: rule-based content, not a voice-leading engine. Bass/tenor come from
// a bass-clef triad built by chord-recognition's buildTriad (bass=root,
// tenor=5th); alto/soprano come from an INDEPENDENTLY placed treble-clef
// triad (alto=3rd, soprano=root raised an octave via raiseOctave) so soprano
// sits above alto rather than doubling it in the same register — the
// standard "root position, doubled root, open" SATB voicing.

import { KB_VERSION } from '../../content/knowledge-base';
import type { Music, NoteEvent, Voice, VoiceName } from '../../music/types';
import { CHORD_NUMERALS, SATB_VOICES, satbVoiceAtom } from '../atoms';
import { mulberry32, pick } from '../rng';
import { scopeForGrade } from '../scope';
import type { ExerciseInstance } from '../schema';
import { buildTriad, raiseOctave } from './chord-recognition';
import { generateValidated, makeInstanceId } from './retry';
import type { GenerateOptions, Generator } from './types';

/** The invariant voice -> {staff, stem} table (design G5-1's load-bearing
 *  mapping): staff 0 = treble, 1 = bass. */
const VOICE_META: Record<VoiceName, { staff: number; stem: 'up' | 'down' }> = {
  soprano: { staff: 0, stem: 'up' },
  alto: { staff: 0, stem: 'down' },
  tenor: { staff: 1, stem: 'up' },
  bass: { staff: 1, stem: 'down' },
};

const VOICE_LABELS: Record<VoiceName, string> = {
  soprano: 'Soprano',
  alto: 'Alto',
  tenor: 'Tenor',
  bass: 'Bass',
};

/** Stave+stem cue text for each option (R3: colour never carries meaning alone). */
const VOICE_CUES: Record<VoiceName, string> = {
  soprano: 'treble, stem up',
  alto: 'treble, stem down',
  tenor: 'bass, stem up',
  bass: 'bass, stem down',
};

/** The satb_voice:* atoms in `atoms`, in atom order — mirrors
 *  transposing-instrument.ts's instrumentsFromAtoms; an unknown voice name
 *  fails loud. */
function voicesFromAtoms(atoms: string[]): VoiceName[] {
  const result: VoiceName[] = [];
  for (const atom of atoms) {
    const [kind, code] = atom.split(':');
    if (kind !== 'satb_voice') continue;
    if (!(SATB_VOICES as readonly string[]).includes(code)) {
      throw new Error(`satb_voice_recognition: atom "${atom}" names an unknown voice`);
    }
    result.push(code as VoiceName);
  }
  if (result.length === 0) {
    throw new Error('satb_voice_recognition: needs at least one satb_voice:* atom');
  }
  return result;
}

function build(contentSeed: number, grade: number, idSeed: number, atoms: string[]): ExerciseInstance {
  if (grade !== 5) {
    throw new Error(`satb_voice_recognition: grade ${grade} is not supported (only 5)`);
  }
  const scope = scopeForGrade(grade);
  const rng = mulberry32(contentSeed);
  const key = pick(rng, [...scope.keysMajor]);
  const numeral = pick(rng, [...CHORD_NUMERALS]);
  const targetVoice = pick(rng, voicesFromAtoms(atoms));

  const [bassRoot, , tenorFifth] = buildTriad('bass', grade, key, numeral);
  // minSpan=7 leaves room above the treble root for raiseOctave's soprano
  // (root+7 diatonic steps), not just the default triad's fifth (root+4).
  const [trebleRoot, altoThird] = buildTriad('treble', grade, key, numeral, 7);

  const pitchByVoice: Record<VoiceName, string> = {
    soprano: raiseOctave(trebleRoot),
    alto: altoThird,
    tenor: tenorFifth,
    bass: bassRoot,
  };

  const voices: Voice[] = SATB_VOICES.map((name) => {
    const note: NoteEvent = {
      type: 'note',
      pitch: pitchByVoice[name],
      dur: 'semibreve',
      ...(name === targetVoice ? { highlight: true } : {}),
    };
    return { events: [note], staff: VOICE_META[name].staff, stem: VOICE_META[name].stem, name };
  });

  const music: Music = {
    clef: 'treble',
    key_sig: `${key}_major`,
    time_sig: null,
    staves: ['treble', 'bass'],
    voices,
  };

  const distractors: VoiceName[] = SATB_VOICES.filter((v) => v !== targetVoice);

  return {
    id: makeInstanceId('satb_voice_recognition', grade, idSeed),
    template_id: 'satb_voice_recognition',
    grade,
    // 'pitch' (not 'chords'): design G5-1 is the amber "Pitch & Notation ·
    // voices" strand — reading a voice off the staff, not naming a harmony.
    strand: 'pitch',
    prompt: 'Which voice sings the highlighted note?',
    stimulus: { music, text: null },
    interaction: {
      type: 'voice_options',
      config: {
        options: SATB_VOICES.map((v) => ({ voice: v, label: VOICE_LABELS[v], cue: VOICE_CUES[v] })),
      },
    },
    answer: { canonical: targetVoice, accepted_alternatives: [] },
    distractors,
    hints: [
      'Stems up point away from the middle (soprano, tenor); stems down point toward it (alto, bass). The treble staff carries the upper pair (soprano/alto), the bass staff the lower pair (tenor/bass).',
    ],
    feedback: {
      correct: 'Correct!',
      incorrect:
        'Not quite — check which staff the note is on (treble = soprano/alto, bass = tenor/bass) and which way its stem points (up = soprano/tenor, down = alto/bass).',
    },
    srs_tags: [satbVoiceAtom(targetVoice)],
    kb_version: KB_VERSION,
  };
}

export const satbVoiceRecognition: Generator = (opts: GenerateOptions) =>
  generateValidated(opts.seed, (candidateSeed) => build(candidateSeed, opts.grade, opts.seed, opts.atoms));
