import {
  decodeCommand,
  decodeEvent,
  encodeCommand,
  encodeEvent,
  type SurfaceCommand,
  type SurfaceEvent,
} from './bridge';

describe('bridge protocol round-trips', () => {
  const commands: SurfaceCommand[] = [
    { type: 'render', abc: 'X:1\nK:C\nC' },
    { type: 'render', abc: 'X:1\nK:C\nC', scale: 1.15 },
    { type: 'play' },
    { type: 'stop' },
    { type: 'highlightBar', bar: 2, color: '#cb7ad4' },
    { type: 'highlightBar', bar: null },
    { type: 'playAbc', abc: 'X:1\nK:C\nC' },
    { type: 'renderToSvg', abc: 'X:1\nK:E\nx4', reqId: 7 },
    { type: 'renderToSvg', abc: 'X:1\nK:E\nx4', scale: 1.5, reqId: 8 },
  ];
  const events: SurfaceEvent[] = [
    { type: 'ready' },
    { type: 'rendered', ms: 12 },
    { type: 'rendered', ms: 12, height: 240 },
    { type: 'primed', ms: 340 },
    { type: 'played', latencyMs: 5 },
    { type: 'finished' },
    { type: 'audioUnsupported' },
    { type: 'error', message: 'boom' },
    { type: 'log', message: 'hi' },
    { type: 'barTapped', bar: 3 },
    { type: 'barHeld', bar: 2 },
    { type: 'svgRendered', reqId: 7, svg: '<svg></svg>', width: 173, height: 62 },
    { type: 'svgRendered', reqId: 8, svg: '', width: 0, height: 0 },
  ];

  test.each(commands)('command %j survives encode -> decode', (cmd) => {
    expect(decodeCommand(encodeCommand(cmd))).toEqual(cmd);
  });

  test.each(events)('event %j survives encode -> decode', (ev) => {
    expect(decodeEvent(encodeEvent(ev))).toEqual(ev);
  });
});
