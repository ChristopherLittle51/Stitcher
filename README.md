# Stitcher

A Hitomezashi-inspired visual cipher for notebook art and shareable decoding puzzles.

## Website

The site is ready to deploy at the repository root.

**Expected GitHub Pages URL after Pages is enabled:**  
https://christopherlittle51.github.io/Stitcher/

GitHub Pages needs to be enabled once for this new repository:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open **Actions → Deploy Stitcher to GitHub Pages** and re-run the failed workflow.

After that, pushes to `main` deploy automatically.

## How the cipher works

Each 5×5 block carries two independent messages:

- **Line/stitch message:** 12 characters per grid — six horizontal stitch tracks and six vertical stitch tracks.
- **Color message:** 10 characters per grid — five symbols encoded by hue across rows and five encoded by light/dark shade down columns.

Every symbol is 5 bits. The alphabet is A–Z followed by space, period, comma, apostrophe, question mark, and ESC.

A stitch segment represents 0 and a gap represents 1. Cell hue carries the color-row bit while light/dark shade carries the color-column bit.

Each grid may independently use:

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
- `vercel.json` — zero-build Vercel configuration

No build step or backend is required.

## Alternative deployment

The repo is also ready for Vercel, Netlify, or Cloudflare Pages as a static site. No build command is required.

## Important

Stitcher is designed as a fun visual puzzle, not serious cryptography.
