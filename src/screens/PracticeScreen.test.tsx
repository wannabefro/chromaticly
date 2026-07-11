// Mock react-native-webview so ExerciseLoop's MusicSurface renders headless.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((_props: Record<string, unknown>, _ref: unknown) => null) };
});

import { fireEvent, render } from '@testing-library/react-native';

import PracticeScreen from './PracticeScreen';

describe('PracticeScreen — runnable exercise harness', () => {
  test('mounts a real generated exercise (the first template) with its prompt', () => {
    const { getByTestId } = render(<PracticeScreen />);
    expect(getByTestId('practice-screen')).toBeTruthy();
    expect(getByTestId('template-label')).toHaveTextContent('note_naming');
    expect(getByTestId('prompt')).toBeTruthy();
  });

  test('answering reveals Next, which advances to the following template', () => {
    const { getByTestId, queryByTestId } = render(<PracticeScreen />);

    expect(queryByTestId('next')).toBeNull();
    fireEvent.press(getByTestId('option-0')); // any answer fires the result
    expect(getByTestId('next')).toBeTruthy();

    fireEvent.press(getByTestId('next'));
    expect(getByTestId('template-label')).toHaveTextContent('interval_naming');
    expect(queryByTestId('next')).toBeNull(); // fresh exercise, not yet answered
  });
});
