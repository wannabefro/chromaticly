// Term ↔ meaning match (design/components 5f), used for direction ↔ meaning and
// instrument ↔ family at Grade 4. A tap-to-pair realisation of the designed
// drag-match: select a meaning from the pool, tap a left term's slot to pair it
// (or tap a filled slot to return its meaning to the pool). Grades only when
// every term is paired; matched pairs read green, the active selection uses the
// strand hue, and empty slots show the dashed target from 5f. (Literal
// drag-gesture lift/tilt is animation polish over this pairing core.)

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, shape, strandDef, type as typo } from '../theme';
import type { InteractionComponentProps } from './types';

export type DragMatchResponse = Record<string, string | null>;

interface DragMatchConfig {
  /** Left-column terms, in display order. */
  left: string[];
  /** Right-column meanings, pre-shuffled by the generator (deterministic). */
  right: string[];
}

export function DragMatch({
  instance,
  response,
  graded,
  strand,
  onResponseChange,
}: InteractionComponentProps<DragMatchResponse>) {
  const { left, right } = instance.interaction.config as unknown as DragMatchConfig;
  const answer = instance.answer.canonical as Record<string, string>;
  const hue = strandDef(strand).hue;
  const revealed = graded !== null;

  // The pool is every meaning not currently paired to a term.
  const assigned = useMemo(() => new Set(Object.values(response).filter((v): v is string => v != null)), [response]);
  const pool = right.filter((m) => !assigned.has(m));

  // A meaning is "held" for placement by tapping it in the pool; the next term
  // tap drops it. Kept in response under the reserved '' key so no extra state
  // escapes the interaction protocol (response is the single source of truth).
  const held = response[''] ?? null;

  const setResponse = (next: DragMatchResponse) => onResponseChange(next);

  const tapPool = (meaning: string) => {
    if (revealed) return;
    setResponse({ ...response, '': held === meaning ? null : meaning });
  };

  const tapTerm = (term: string) => {
    if (revealed) return;
    const current = response[term] ?? null;
    if (held) {
      // Place the held meaning; any meaning already in this slot returns to the pool.
      setResponse({ ...response, [term]: held, '': null });
    } else if (current) {
      // No held meaning: clear this slot back to the pool.
      setResponse({ ...response, [term]: null });
    }
  };

  const slotState = (term: string): 'empty' | 'filled' | 'correct' | 'incorrect' => {
    const current = response[term] ?? null;
    if (revealed) return current === answer[term] ? 'correct' : 'incorrect';
    return current ? 'filled' : 'empty';
  };

  return (
    <View style={styles.container} testID="drag-match">
      {left.map((term) => {
        const current = response[term] ?? null;
        const state = slotState(term);
        return (
          <Pressable
            key={term}
            testID={`drag-match-term-${term}`}
            onPress={() => tapTerm(term)}
            style={styles.row}
          >
            <View style={[styles.term, current == null && held != null && !revealed && { borderColor: hue }]}>
              <Text style={styles.termText}>{term}</Text>
            </View>
            <View style={[styles.connector, state === 'correct' && { backgroundColor: colors.correct }]} />
            <View style={[styles.slot, slotStyle(state, hue)]}>
              <Text style={[styles.slotText, slotTextStyle(state)]}>{revealed ? answer[term] : current ?? ' '}</Text>
            </View>
          </Pressable>
        );
      })}

      {!revealed && (
        <View style={styles.pool} testID="drag-match-pool">
          {pool.map((meaning) => (
            <Pressable
              key={meaning}
              testID={`drag-match-pool-${meaning}`}
              onPress={() => tapPool(meaning)}
              style={[styles.poolChip, held === meaning && { borderColor: hue, backgroundColor: `${hue}24` }]}
            >
              <Text style={[styles.poolText, held === meaning && { color: hue }]}>{meaning}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function slotStyle(state: 'empty' | 'filled' | 'correct' | 'incorrect', hue: string) {
  switch (state) {
    case 'filled':
      return { borderColor: hue, borderStyle: 'solid' as const, backgroundColor: `${hue}24` };
    case 'correct':
      return { borderColor: colors.correct, borderStyle: 'solid' as const, backgroundColor: colors.correctSurface };
    case 'incorrect':
      return { borderColor: colors.incorrect, borderStyle: 'solid' as const, backgroundColor: colors.incorrectSurface };
    default:
      return { borderColor: colors.border, borderStyle: 'dashed' as const };
  }
}

function slotTextStyle(state: 'empty' | 'filled' | 'correct' | 'incorrect') {
  if (state === 'correct') return { color: colors.correct };
  if (state === 'incorrect') return { color: colors.incorrect };
  if (state === 'filled') return { color: colors.text };
  return { color: colors.textFaint };
}

const styles = StyleSheet.create({
  container: { gap: shape.spaceInline },
  row: { flexDirection: 'row', alignItems: 'center', gap: shape.spaceSnug },
  term: {
    flex: 1,
    minHeight: shape.tapMin,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: shape.spaceInline,
  },
  termText: { ...typo.option, color: colors.text, fontWeight: '700', textAlign: 'center' },
  connector: { width: 20, height: 2, backgroundColor: colors.border },
  slot: {
    flex: 1.2,
    minHeight: shape.tapMin,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: shape.spaceInline,
  },
  slotText: { ...typo.option, textAlign: 'center' },
  pool: { flexDirection: 'row', flexWrap: 'wrap', gap: shape.spaceSnug, marginTop: shape.spaceSnug },
  poolChip: {
    minHeight: shape.tapMin,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: shape.spaceCard,
    paddingVertical: shape.spaceSnug,
  },
  poolText: { ...typo.option, color: colors.text },
});
