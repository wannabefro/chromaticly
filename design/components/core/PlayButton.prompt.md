The universal "everything sounds" affordance. On paper cards use `onPaper`; elsewhere it renders as a tinted ring in the strand hue.

```jsx
<PlayButton onPaper />
<PlayButton strand="terms" size={28} />
<PlayButton onPaper disabled />
```

Disabled (`disabled`) is the "nothing to hear yet" state — dimmed and non-interactive, e.g. the transposition answer card's "hear yours" button until at least one note is placed.
