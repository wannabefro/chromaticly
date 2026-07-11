// U2 acceptance tests for the strand identifier (design/components/core/
// StrandChip.prompt.md, never-violate rule 3: colour always paired with glyph/label).

import { render } from '@testing-library/react-native';

import { STRAND_DEFS } from '../theme';
import { StrandChip } from './StrandChip';

describe('StrandChip', () => {
  test('renders the strand label and glyph for strand="pitch" (rule 3)', () => {
    const { getByText } = render(<StrandChip strand="pitch" showGlyph testID="chip" />);

    expect(getByText(STRAND_DEFS.pitch.label)).toBeTruthy();
    expect(getByText(STRAND_DEFS.pitch.glyph)).toBeTruthy();
  });
});
