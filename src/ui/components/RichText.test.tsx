// RichText (chromaticly-e3z.19). The invariant is that emphasis is delivered by a
// FAMILY swap, never by fontStyle alone: iOS renders a custom face upright when
// asked for an italic it does not have, so a style-only italic is no emphasis.

import { render } from '@testing-library/react-native';

import { fonts, type as typo } from '../theme';
import { RichText } from './RichText';

function flatten(style: unknown): { fontFamily?: string } {
  const parts = Array.isArray(style) ? style : [style];
  return Object.assign({}, ...parts.filter(Boolean));
}

describe('RichText', () => {
  test('*term* renders in the italic face, not merely fontStyle: italic', () => {
    const { getByText } = render(<RichText>{'a *largo* marking'}</RichText>);
    expect(flatten(getByText('largo').props.style).fontFamily).toBe(fonts.uiItalic);
  });

  test('**word** renders in the bold face', () => {
    const { getByText } = render(<RichText>{'the **same** pitch'}</RichText>);
    expect(flatten(getByText('same').props.style).fontFamily).toBe(typo.cardTitle.fontFamily);
  });

  test('the markers never reach the screen', () => {
    const { queryByText, toJSON } = render(<RichText>{'a *largo* and a **same**'}</RichText>);
    expect(queryByText('*largo*')).toBeNull();
    expect(JSON.stringify(toJSON())).not.toContain('*');
  });

  test('an unpaired asterisk is left as written, not treated as an opening marker', () => {
    const { getByText } = render(<RichText>{'2 * 3 = 6'}</RichText>);
    expect(getByText('2 * 3 = 6')).toBeTruthy();
  });

  test('an empty marker pair is not emphasis — it would render nothing', () => {
    const { getByText } = render(<RichText>{'a ** b'}</RichText>);
    expect(getByText('a ** b')).toBeTruthy();
  });

  test('plain text passes through unchanged', () => {
    const { getByText } = render(<RichText style={{ color: '#fff' }}>{'no markup here'}</RichText>);
    expect(getByText('no markup here')).toBeTruthy();
  });
});
