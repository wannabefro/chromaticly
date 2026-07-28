// Platform adapter for the learning clock (G6 U1). The only place `Date.now()`
// is read for SRS purposes — everything in the core takes a `Clock` so tests can
// advance time by hand.

import { clockFrom, type Clock } from '../learn/clock';

export const systemClock: Clock = clockFrom(() => Date.now());
