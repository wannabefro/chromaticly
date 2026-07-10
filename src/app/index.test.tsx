import { render } from '@testing-library/react-native';

import HomeScreen from './index';

// U1 smoke test: proves the Expo + jest-expo + Testing Library toolchain runs.
test('renders the home screen without crashing', () => {
  const { getByText } = render(<HomeScreen />);
  expect(getByText('Chromaticly')).toBeTruthy();
});
