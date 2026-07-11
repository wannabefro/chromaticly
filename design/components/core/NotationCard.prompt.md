The stave is the hero: a light-paper card (never inverts in dark mode) with staff lines + clef, a play button, and an SVG slot the production renderer (abcjs/VexFlow) draws into.

```jsx
<NotationCard clef="𝄞" caption="minim" zoomHint>
  <ellipse cx="170" cy="48" rx="10" ry="7.5" fill="var(--strand-pitch)" transform="rotate(-20 170 48)" />
</NotationCard>
<NotationCard register="exam" play={false} />
```

Interactive overlays (ghost slots, bar highlights, selection halos) render as SVG children.
