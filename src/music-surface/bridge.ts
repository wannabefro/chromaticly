// Typed message protocol between React Native and the WebView music surface (U3).
// Both directions are JSON strings over WebView postMessage.

/** RN → WebView commands. */
export type SurfaceCommand =
  | { type: 'render'; abc: string }
  | { type: 'play' }
  | { type: 'stop' };

/** WebView → RN events, including instrumentation timings (ms). */
export type SurfaceEvent =
  | { type: 'ready' }
  | { type: 'rendered'; ms: number }
  | { type: 'primed'; ms: number }
  | { type: 'played'; latencyMs: number }
  | { type: 'finished' }
  | { type: 'audioUnsupported' }
  | { type: 'error'; message: string }
  | { type: 'log'; message: string };

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
