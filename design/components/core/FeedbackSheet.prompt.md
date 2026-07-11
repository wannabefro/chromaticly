Slides from the bottom after Check; never a toast. Incorrect copy names the misconception ("That's the note's name in the bass clef — check the clef sign") and shows the correct answer rendered on paper with its own play button.

```jsx
<FeedbackSheet kind="incorrect"
  message={<>That's the bass-clef name — check the clef sign. In the treble clef this note is <b>D</b>.</>}
  correctAnswer={<NotationCard height={58} play />} />
```

Partially-correct multi-part items don't use the sheet — per-part ✓/× render inline on the interaction zone.
