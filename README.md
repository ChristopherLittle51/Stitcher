# Stitcher

A Hitomezashi-inspired visual cipher for notebook art and shareable decoding puzzles.

## Live site

https://christopherlittle51.github.io/Stitcher/

## How the cipher works

Each 5×5 block carries two independent messages:

- **Line message:** 12 characters per grid — six horizontal stitch tracks and six vertical stitch tracks.
- **Color message:** 10 characters per grid — five hue rows and five shade columns.

Every symbol is 5 bits. The alphabet is A–Z followed by space, period, comma, apostrophe, question mark, and ESC.

A stitch segment represents 0 and a gap represents 1. Cell hue carries the color-row bit while light/dark shade carries the color-column bit.

Each grid may also independently use:

- one of 12 complementary hue pairs as a signed modulo-32 substitution shift;
- 0°, 90°, 180°, or 270° rotation, indicated by the orientation dot.

## Puzzle scoring

Challenges begin at 100 points. Optional hints subtract points based on how much of the mechanic they reveal. The site tracks hint usage and final score locally in the browser.

## Project structure

- `index.html` — site structure
- `styles.css` — responsive design
- `cipher.js` — cipher rules, rendering, challenge serialization, and answer hashing
- `app.js` — creator, solver, hints, scoring, and share-link UI
- `.github/workflows/pages.yml` — GitHub Pages deployment

No build step or backend is required.


## Deployment

### GitHub Pages

GitHub requires a repository owner to enable Pages once before the workflow can publish a brand-new repository.

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Re-run the **Deploy Stitcher to GitHub Pages** workflow.

After that, pushes to `main` deploy automatically.

### Vercel

This is also a zero-build static site. Import this GitHub repository into Vercel and leave the build command/output directory at their static defaults. `vercel.json` is included.
