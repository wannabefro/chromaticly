import { fireEvent, render } from '@testing-library/react-native';

import type { StrandMastery } from '../../learn/mastery-rollup';
import { STRAND_DEFS, STRAND_ORDER } from '../theme';
import { StrandRadar } from './StrandRadar';

function mastery(values: Partial<Record<string, number>>): Record<string, StrandMastery> {
  const out: Record<string, StrandMastery> = {};
  for (const strand of STRAND_ORDER) {
    const value = values[strand] ?? 0;
    out[strand] = { value, mastered: Math.round(value * 10), total: 10 };
  }
  return out;
}

describe('StrandRadar (design 6d)', () => {
  test('nothing mastered draws the dashed promise, not a weakest pill', () => {
    const { getByTestId, queryByTestId } = render(<StrandRadar mastery={mastery({})} />);
    expect(getByTestId('strand-radar-empty')).toBeTruthy();
    expect(queryByTestId('radar-weakest')).toBeNull();
  });

  // Rule 3: strand colour is never shown without a text label beside it. The legend
  // carries the label for each hued vertex.
  test('every strand has a labelled legend row, in canonical order', () => {
    const { getByTestId } = render(<StrandRadar mastery={mastery({ rhythm: 0.9 })} />);
    for (const strand of STRAND_ORDER) {
      const row = getByTestId(`radar-legend-${strand}`);
      expect(row).toHaveTextContent(new RegExp(STRAND_DEFS[strand].short));
    }
    expect(getByTestId('radar-legend-rhythm')).toHaveTextContent(/90%/);
  });

  test('the weakest started strand is named and drills on tap', () => {
    const onDrill = jest.fn();
    // Rhythm strong, pitch the weakest started strand; context untouched (0, not "weak").
    const { getByTestId } = render(
      <StrandRadar mastery={mastery({ rhythm: 0.9, pitch: 0.3, scales_keys: 0.6 })} onDrill={onDrill} />,
    );
    const pill = getByTestId('radar-weakest');
    expect(pill).toHaveTextContent(new RegExp(STRAND_DEFS.pitch.label));

    fireEvent.press(pill);
    expect(onDrill).toHaveBeenCalledWith('pitch');
  });

  // Grade 1 has no chords lessons. A strand with no content is "not taught yet", not
  // "0% mastered" — it reads as — in the legend, never a failure spike.
  test('a strand with no content shows a dash, not 0%', () => {
    const m = mastery({ rhythm: 1 });
    m.chords = { value: 0, mastered: 0, total: 0 };
    const { getByTestId } = render(<StrandRadar mastery={m} />);
    expect(getByTestId('radar-legend-chords')).toHaveTextContent(/—/);
    expect(getByTestId('radar-legend-chords')).not.toHaveTextContent(/0%/);
    // A content strand at zero still reads as a real 0%.
    m.pitch = { value: 0, mastered: 0, total: 10 };
    const { getByTestId: get2 } = render(<StrandRadar mastery={m} />);
    expect(get2('radar-legend-pitch')).toHaveTextContent(/0%/);
  });

  test('a fully-mastered profile has no weakest strand', () => {
    const all = Object.fromEntries(STRAND_ORDER.map((s) => [s, 1]));
    const { queryByTestId } = render(<StrandRadar mastery={mastery(all)} />);
    expect(queryByTestId('radar-weakest')).toBeNull();
    expect(queryByTestId('strand-radar-empty')).toBeNull();
  });
});
