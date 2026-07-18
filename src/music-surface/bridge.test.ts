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
    { type: 'play' },
    { type: 'stop' },
    { type: 'highlightBar', bar: 2, color: '#cb7ad4' },
    { type: 'highlightBar', bar: null },
  ];
  const events: SurfaceEvent[] = [
    { type: 'ready' },
    { type: 'rendered', ms: 12 },
    { type: 'primed', ms: 340 },
    { type: 'played', latencyMs: 5 },
    { type: 'finished' },
    { type: 'audioUnsupported' },
    { type: 'error', message: 'boom' },
    { type: 'log', message: 'hi' },
    { type: 'barTapped', bar: 3 },
    { type: 'barHeld', bar: 2 },
  ];

  test.each(commands)('command %j survives encode -> decode', (cmd) => {
    expect(decodeCommand(encodeCommand(cmd))).toEqual(cmd);
  });

  test.each(events)('event %j survives encode -> decode', (ev) => {
    expect(decodeEvent(encodeEvent(ev))).toEqual(ev);
  });
});
