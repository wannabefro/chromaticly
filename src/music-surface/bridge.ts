// Typed message protocol between React Native and the WebView music surface (U3).
// Both directions are JSON strings over WebView postMessage.

/** RN → WebView commands. */
export type SurfaceCommand =
  /** Render ABC. `scale` (abcjs staff scale, design 5c notation size) is optional;
   *  the page keeps its baked default when it is absent. `staffwidth` is an optional
   *  density-aware layout width — wider for note-dense stimuli so they aren't squeezed
   *  into the narrow baked width; absent for sparse stimuli (keeps the baked default). */
  | { type: 'render'; abc: string; scale?: number; staffwidth?: number }
  | { type: 'play' }
  | { type: 'stop' }
  /** Tint the selected bar in the rendered score (design 4c), or clear it with
   *  `bar: null`. `color` is the strand hue the RN side owns. */
  | { type: 'highlightBar'; bar: number | null; color?: string }
  /** "Hear yours" (D9): parse+play `abc` in a HIDDEN in-page container, without
   *  touching or repainting the visible score. Used by an answer card (e.g.
   *  transposition_input) whose Music is built from the learner's own response,
   *  not the stimulus — a second WebView would fight the one-persistent-surface
   *  architecture, so this reuses the single mounted surface instead. */
  | { type: 'playAbc'; abc: string };

/** WebView → RN events, including instrumentation timings (ms). */
export type SurfaceEvent =
  | { type: 'ready' }
  | { type: 'rendered'; ms: number }
  | { type: 'primed'; ms: number }
  | { type: 'played'; latencyMs: number }
  | { type: 'finished' }
  | { type: 'audioUnsupported' }
  | { type: 'error'; message: string }
  | { type: 'log'; message: string }
  /** The learner tapped a bar directly in the score (1-indexed, design 4c). */
  | { type: 'barTapped'; bar: number }
  /** The learner long-pressed a bar to hear just it (1-indexed, design 4c). The surface
   *  plays that bar itself; this fires so RN can react (feedback), not to drive audio. */
  | { type: 'barHeld'; bar: number };

export function encodeCommand(cmd: SurfaceCommand): string {
  return JSON.stringify(cmd);
}

export function decodeCommand(raw: string): SurfaceCommand {
  return JSON.parse(raw) as SurfaceCommand;
}

export function encodeEvent(ev: SurfaceEvent): string {
  return JSON.stringify(ev);
}

export function decodeEvent(raw: string): SurfaceEvent {
  return JSON.parse(raw) as SurfaceEvent;
}
