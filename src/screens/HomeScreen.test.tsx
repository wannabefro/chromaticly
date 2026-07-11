import { render } from '@testing-library/react-native';

// Link needs router context we don't stand up in a unit test; pass its child through.
jest.mock('expo-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => children }));

import HomeScreen from './HomeScreen';

// U1 smoke test: proves the Expo + jest-expo + Testing Library toolchain runs.
test('renders the home screen without crashing', () => {
  const { getByText } = render(<HomeScreen />);
  expect(getByText('Chromaticly')).toBeTruthy();
});

test('offers a way into practice', () => {
  const { getByTestId } = render(<HomeScreen />);
  expect(getByTestId('start-practice')).toBeTruthy();
});
