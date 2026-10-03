# Stitcher

A Hitomezashi-inspired visual cipher for notebook art and shareable decoding puzzles.

## Website

https://christopherlittle51.github.io/Stitcher/

Pushes to `main` deploy automatically with GitHub Actions.

## Puzzle modes

### Modern

The original Stitcher mode uses fixed 5×5 color cells bounded by six horizontal and six vertical stitch tracks.

- **Line/stitch message:** 12 characters per grid.
- **Color message:** 10 characters per grid.
- **Alphabet:** 32 fixed-width 5-bit symbols — A–Z, space, period, comma, apostrophe, question mark, and ESC.
- Individual stitch segments are binary data.
- Hue and shade carry a second independent bitstream.
- Every grid can use an independent 12-step color-wheel shift and 0°/90°/180°/270° rotation.

Modern challenge links use the `#c=` format.

### Classic Hitomezashi

Classic mode preserves the traditional alternating Hitomezashi structure instead of treating every stitch segment as an independent bit.

- Every horizontal and vertical track alternates stitch / gap continuously.
- The only structural bit on a track is its **starting phase**: starts stitched or starts with a gap.
- Five track phases form one character.
- Grid size is arbitrary. The generator expands in five-track groups until the stitch message fits and enough enclosed regions exist for the second message.
- The generator flood-fills the finished stitch topology and uses only genuinely enclosed regions for surface data.
- Enclosed regions use two decorative base hues. **Hue is not data.**
- Light shade = 0 and dark shade = 1.
- The first five shaded regions make one surface character, the next five make the next character, and so on in top-left reading order.
- Open fabric areas that reach the outside are left unfilled.

Classic uses a deliberately smaller alphabet: **A–Z + SPACE**. That is 27 symbols, so **5 bits is already the minimum possible fixed-width encoding**. Four bits can represent only 16 values. A variable-length alphabet could reduce average message size, but it would remove the clean rule that every five phases or five shaded regions equals exactly one character.

Classic challenge links use the `#k=` format.

## Scoring

Stitcher scores the amount of built-in solving assistance used rather than charging for general hints.

### Modern

The theoretical maximum is based on message length plus per-grid controls.

- Mark one real message bit in the worksheet: −1 point the first time.
- Use a grid's rotation control: −2 points once.
- Move a grid's color wheel: −4 points once.
- General hints, colorblind mode, and typing final answers are free.

### Classic

The theoretical maximum is `5 × (stitch characters + shade characters)`.

- Mark one real track-phase bit: −1 point the first time.
- Mark one real enclosed-region shade bit: −1 point the first time.
- General rules/hints and final answer entry are free.

Clearing or changing a bit never refunds points and never charges that same bit twice.

## Sharing

Both modes create self-contained challenge URLs and support spoiler-free result sharing with score, percentage, assist usage, and the original puzzle link.

## Project structure

- `index.html` — base site structure
- `styles.css` — Modern responsive design
- `cipher.js` — Modern cipher engine and serialization
- `app.js` — Modern creator/solver/scoring/share UI
- `classic.js` — Classic alternating-track engine, enclosed-region topology, rendering, and compact serialization
- `classic-ui.js` — Classic creator, solver, scoring, and result sharing
- `classic.css` — Classic mode styling
- `.github/workflows/pages.yml` — syntax checks, Classic codec smoke test, site assembly, and GitHub Pages deployment
- `vercel.json` — zero-build Vercel configuration for the base static site

No backend is required.

## Important

Stitcher is designed as a visual puzzle, not serious cryptography.
