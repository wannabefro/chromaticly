import { fireEvent, render } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { buildContextPassage } from '../engine/generators/context-passage';
import { ContextRunner } from './ContextRunner';

jest.mock('react-native-webview', () => {
  const React = require('react');
  return {
    WebView: React.forwardRef((_props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ postMessage: () => {} }));
      return null;
    }),
  };
});

describe('ContextRunner — a tall passage must not push its answer control off-screen', () => {
  const passage = buildContextPassage({ grade: 1, seed: 2, atoms: ['find_bar:highest'] });

  /** Returns a boolean by identity: comparing two RN trees with toBe serialises
   *  both on failure and runs the heap out. */
  function hasAncestor(node: unknown, ancestor: unknown): boolean {
    for (let n: any = node; n; n = n.parent) if (n === ancestor) return true;
    return false;
  }

  test('find_the_bar sits outside the scrolling question area, where Check already lives', () => {
    const { getByTestId, UNSAFE_getByType } = render(
      <ContextRunner passage={passage} onSubResult={jest.fn()} onDone={jest.fn()} />,
    );
    const body = UNSAFE_getByType(ScrollView);
    expect(hasAncestor(getByTestId('find-the-bar'), body)).toBe(false);
    expect(hasAncestor(getByTestId('check'), body)).toBe(false);
    expect(hasAncestor(getByTestId('prompt'), body)).toBe(true);
  });

  test('the strip survives grading, so the pick stays visible behind the sheet', () => {
    const { getByTestId, UNSAFE_getByType } = render(
      <ContextRunner passage={passage} onSubResult={jest.fn()} onDone={jest.fn()} />,
    );
    fireEvent.press(getByTestId('bar-1'));
    fireEvent.press(getByTestId('check'));
    expect(hasAncestor(getByTestId('find-the-bar'), UNSAFE_getByType(ScrollView))).toBe(false);
  });
});
