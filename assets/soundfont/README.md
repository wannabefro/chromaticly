# Soundfont (offline audio — KTD8)

The WebView music surface (U3) plays notation with abcjs's synth, which loads
per-note MP3 samples. To work offline (a Definition-of-Done gate), those samples
are **bundled here** instead of fetched from a CDN.

**Chosen artifact:** the `acoustic_grand_piano-mp3` voice from the
`paulrosen/midi-js-soundfonts` set (the collection abcjs's synth defaults to).
Only the piano voice is needed for the Grade 1 slice (single notes, intervals,
triads, key context).

**Not yet vendored** — the MP3 samples are binary and were not fetchable in the
headless build session (no network for asset download). Populate this folder in
U3 by copying the `FluidR3_GM/acoustic_grand_piano-mp3/` directory from
`midi-js-soundfonts`, then point the WebView's abcjs `soundFontUrl` at it.
