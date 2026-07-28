// chromaticly-9c8. The ornament card shipped rendering NOTHING — hero and inset both —
// while every test passed and nothing was logged. The cause was layout, not notation:
// MusicSurface's wrapper declares only a height and its WebView has no intrinsic width,
// so any parent that sizes a child to its content (alignItems:'center', a bare
// flexShrink) collapses the surface to 0 wide. abcjs still renders — it lays out to
// `staffwidth`, not the viewport — and still reports a height, so the stave skeleton is
// dismissed and the card reads blank.
//
// Jest's renderer has no layout, so it cannot catch the collapse itself (same class as
// the ExerciseLoop flex-parent trap). What it CAN pin is the style contract that caused
// it: neither surface container may size the surface to its content.

import { render } from '@testing-library/react-native';

import { SettingsProvider } from '../../learn/SettingsContext';
import type { SnapshotStorage } from '../../learn/store';
import type { Music } from '../../music/types';
import { OrnamentCard } from './OrnamentCard';

const storage: SnapshotStorage = {
  load: async () => JSON.stringify({ version: 1, settings: { notationScale: 'medium', handedness: 'right' } }),
  save: async () => {},
};

jest.mock('../../music-surface/MusicSurface', () => {
  const { View } = require('react-native');
  return { MusicSurface: (props: Record<string, unknown>) => <View testID="surface" {...props} /> };
});

const MUSIC: Music = {
  clef: 'treble',
  key_sig: null,
  time_sig: null,
  voices: [{ events: [{ type: 'note', pitch: 'G4', dur: 'semibreve', ornament: { kind: 'turn' } }] }],
};

function flatten(style: unknown): Record<string, unknown> {
  const parts = Array.isArray(style) ? style : [style];
  return Object.assign({}, ...parts.filter(Boolean).map((s) => (typeof s === 'object' ? s : {})));
}

describe('OrnamentCard layout — the surface must never be sized to its content', () => {
  function renderCard() {
    return render(
      <SettingsProvider storage={storage}>
        <OrnamentCard music={MUSIC} />
      </SettingsProvider>,
    );
  }

  test('the hero row stretches its surface rather than centring it to content width', () => {
    const { getByTestId } = renderCard();
    const hero = getByTestId('ornament-card').props.children[0];
    const style = flatten(hero.props.style);
    // 'center' on the cross axis is the exact bug: it sizes the width-less surface to
    // its (zero) content. The page centres the stave itself, so stretch loses nothing.
    expect(style.alignItems).not.toBe('center');
    expect(style.alignItems).toBe('stretch');
  });

  test('the in-context inset claims a share of its row instead of shrinking to content', () => {
    const { getByTestId } = renderCard();
    const inset = getByTestId('ornament-card').props.children[2];
    const staveWrapper = inset.props.children[0];
    const style = flatten(staveWrapper.props.style);
    // flexShrink alone leaves the wrapper content-sized — and the surface has no
    // intrinsic width, so that content is 0. It must claim positive flex.
    expect(typeof style.flex).toBe('number');
    expect(style.flex as number).toBeGreaterThan(0);
  });
});
