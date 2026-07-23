Recognition control for Chords & Harmony (see canvas 10a) and the cadence boxes under melody notes (5g). Selected uses the chords strand hue; after Check the correct chip shows its spelled triad and each chip replays its chord on tap.

```jsx
<RomanNumeralBoxes numerals={['I','IV','V']} labels={['C','F','G']} states={['default','selected','default']} />
<RomanNumeralBoxes numerals={['I','IV','V']} states={['correct','incorrect','disabled']} metas={['✓ C–E–G','× your pick','G']} />
```

First slice is recognition-only; chord construction (stave input) is a later extension.
