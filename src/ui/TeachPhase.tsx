// Lesson teach/read phase (302.3, design 4a/4b): the concept intro shown before
// the exercise set. A scrollable stack of workbook cards — "In this lesson you'll
// learn" objectives, a concept card (notation on paper + play, rules 1/2), the
// reusable smart tip, and the pre-solved worked example — under a sticky "Start
// exercises" CTA. One accent per screen: the lesson's strand hue (rule 3, always
// paired with the StrandChip glyph/label). The did-you-know and theory-in-sound
// cards (302.3.4/5) slot in between the smart tip and the worked example.

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Lesson } from '../content/lessons';
import { generate } from '../engine/generators';
import { Button } from './components/Button';
import { NotationCard } from './components/NotationCard';
import { StrandChip } from './components/StrandChip';
import { assembleOptions, type Option } from './grading';
import { colors, shape, strandDef, type as typo, type Strand } from './theme';

export interface TeachPhaseProps {
  lesson: Lesson;
  /** The sticky "Start exercises" CTA — hands off to the exercise set. */
  onStart: () => void;
  /** Back chevron. */
  onClose?: () => void;
}

export function TeachPhase({ lesson, onStart, onClose }: TeachPhaseProps) {
  const teach = lesson.teach;
  const strand = lesson.strand as Strand;
  const hue = strandDef(strand).hue;

  const conceptMusic = useMemo(() => {
    const ex = teach?.concept.example;
    if (!ex) return null;
    return generate(ex.template_id, { grade: ex.grade, seed: ex.seed, atoms: lesson.atoms }).stimulus.music;
  }, [teach, lesson]);

  // The worked example rendered pre-solved: its question, notation (if any), and
  // options with the correct one highlighted. Flashcards are self-graded and carry
  // no options, so they simply don't produce a worked-example card.
  const worked = useMemo(() => {
    const we = lesson.worked_example;
    if (!we) return null;
    const inst = generate(we.template_id, { grade: we.grade, seed: we.seed, atoms: lesson.atoms });
    const options: Option[] = inst.interaction.type === 'flashcard' ? [] : assembleOptions(inst);
    if (options.length < 2) return null;
    return { prompt: inst.prompt, music: inst.stimulus.music, text: inst.stimulus.text, options };
  }, [lesson]);

  if (!teach) return null; // no teach content — the caller skips straight to the set

  return (
    <View style={styles.screen} testID="teach-phase">
      <View style={styles.header}>
        <Pressable testID="teach-close" onPress={onClose} hitSlop={12}>
          <Text style={styles.chevron}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {lesson.title}
          </Text>
          <Text style={styles.headerSub}>teach</Text>
        </View>
        <StrandChip strand={strand} showGlyph />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={[styles.overline, { color: hue }]}>In this lesson you&apos;ll learn</Text>
          <View style={styles.objectives}>
            {teach.objectives.map((objective, i) => (
              <View key={i} style={styles.objectiveRow}>
                <Text style={[styles.objectiveNum, { color: hue }]}>{i + 1}</Text>
                <Text style={styles.objectiveText}>{objective}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{teach.concept.title}</Text>
          <Text style={styles.body}>{teach.concept.body}</Text>
          {conceptMusic && (
            <View testID="teach-concept-notation">
              <NotationCard music={conceptMusic} testID="teach-concept-card" />
            </View>
          )}
        </View>

        {teach.smartTip && (
          <View style={styles.tip} testID="teach-smart-tip">
            <Text style={styles.tipIcon}>💡</Text>
            <View style={styles.tipBody}>
              <Text style={styles.tipLabel}>SMART TIP</Text>
              <Text style={styles.tipText}>{teach.smartTip}</Text>
            </View>
          </View>
        )}

        {worked && (
          <View style={styles.card} testID="teach-worked-example">
            <Text style={[styles.overline, { color: colors.hint }]}>Worked example</Text>
            <Text style={styles.body}>{worked.text ?? worked.prompt}</Text>
            {worked.music && (
              <View testID="teach-worked-notation">
                <NotationCard music={worked.music} testID="teach-worked-card" />
              </View>
            )}
            <View style={styles.workedOptions}>
              {worked.options.map((opt, i) => (
                <View
                  key={i}
                  style={[styles.workedOption, opt.correct && styles.workedOptionCorrect]}
                  testID={opt.correct ? 'teach-worked-correct' : undefined}
                >
                  <Text style={[styles.workedOptionLabel, opt.correct && styles.workedOptionLabelCorrect]}>
                    {opt.label}
                    {opt.correct ? '  ✓' : ''}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.workedNote}>The answer is highlighted so you can see the reasoning before trying your own.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Start exercises" strand={strand} onPress={onStart} testID="teach-start" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: shape.spaceInline,
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceInline,
    paddingBottom: shape.spaceInline,
  },
  chevron: { fontFamily: typo.title.fontFamily, fontSize: 24, color: colors.textMuted },
  headerText: { flex: 1 },
  headerTitle: { ...typo.cardTitle, color: colors.text },
  headerSub: { ...typo.label, color: colors.textFaint },

  scroll: { paddingHorizontal: shape.spaceScreenX, paddingBottom: shape.spaceCard, gap: shape.spaceStack },

  card: {
    backgroundColor: colors.surfaceCard,
    borderWidth: shape.borderW,
    borderColor: colors.border,
    borderRadius: shape.radiusCard,
    padding: shape.spaceCard,
    gap: shape.spaceInline,
  },
  overline: { ...typo.overline },
  cardTitle: { ...typo.cardTitle, color: colors.text },
  body: { ...typo.body, color: colors.textMuted },

  objectives: { gap: 8 },
  objectiveRow: { flexDirection: 'row', gap: 10 },
  objectiveNum: { ...typo.body, fontFamily: typo.cardTitle.fontFamily },
  objectiveText: { ...typo.body, color: colors.text, flex: 1 },

  tip: {
    flexDirection: 'row',
    gap: shape.spaceInline,
    alignItems: 'flex-start',
    backgroundColor: colors.hintSurface,
    borderWidth: shape.borderW,
    borderColor: colors.hint,
    borderRadius: shape.radiusControl,
    padding: shape.spaceCard,
  },
  tipIcon: { fontSize: 20 },
  tipBody: { flex: 1, gap: 3 },
  tipLabel: { ...typo.label, color: colors.hint, letterSpacing: 0.6 },
  tipText: { ...typo.body, color: colors.text },

  workedOptions: { flexDirection: 'row', gap: 9 },
  workedOption: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: shape.radiusControl,
    borderWidth: shape.borderWActive,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCardSunken,
    alignItems: 'center',
  },
  workedOptionCorrect: { borderColor: colors.hint, backgroundColor: colors.hintSurface },
  workedOptionLabel: { ...typo.body, color: colors.textMuted, textAlign: 'center' },
  workedOptionLabelCorrect: { color: colors.hint, fontFamily: typo.cardTitle.fontFamily },
  workedNote: { ...typo.label, color: colors.textFaint, lineHeight: 16 },

  footer: {
    paddingHorizontal: shape.spaceScreenX,
    paddingTop: shape.spaceInline,
    paddingBottom: 30,
    borderTopWidth: shape.borderW,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
