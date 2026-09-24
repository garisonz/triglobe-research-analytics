# Triglobe illustration sets

The hero globe uses the **original** illustration. The other three images use
the **minimal** set: clean outlines, a few flat gray fills,
and generous negative space. Subjects and canvas dimensions are unchanged.
Both sets are original, editable vector illustrations exported to PNG.

## Switch back to the original set

In `client/src/lib/illustrations.ts`, change:

```ts
export const illustrationStyle: "minimal" | "original" = "minimal"
```

to:

```ts
export const illustrationStyle: "minimal" | "original" = "original"
```

This changes the default for supporting illustrations. The hero has an explicit
`"original"` override in `LandingPage.tsx`. Vite updates the development preview;
rebuild the frontend for a production deployment. No files need to be overwritten.

- Active supporting PNGs: `client/public/images/minimal/`
- Active hero: `client/public/images/archive/editorial-v1/hero-globe.png`
- Active editable SVGs: `client/public/images/minimal/sources/`
- Preserved original PNGs and SVGs: `client/public/images/archive/editorial-v1/`
- Original PNG checksums: `archive/editorial-v1/checksums.json`

Duplicate originals and the unused minimal hero have been removed. The archive
is the single preserved copy of the remaining originals; preserve these assets unless their removal is explicitly requested. The coin
and figure have been removed from the site; their original assets remain archived.

## Replacement checklist

Replace files in `minimal/` to change the three supporting illustrations.
The hero uses the preserved original asset. The frontend
applies `grayscale(100%) contrast(1.1)` to every image. Keep transparency on all cutouts.

| Filename                | Dimensions     | Background  | Subject                                        |
| ----------------------- | -------------- | ----------- | ---------------------------------------------- |
| `hero-globe.png`        | 1200 × 1400 px | Transparent | Archived original globe, newspaper, and string |
| `politics.png`          | 480 × 480 px   | Transparent | Classical civic building                       |
| `business.png`          | 480 × 480 px   | Transparent | Balance scales                                 |
| `nations.png`           | 480 × 480 px   | Transparent | Compass                                        |

## Re-export edited SVGs

With Node and Playwright's Chromium browser installed, run from `client/`:

```bash
node scripts/render-illustrations.mjs
```

To render only selected assets:

```bash
node scripts/render-illustrations.mjs politics business nations
```

The script writes only to `images/minimal/` and leaves the original archive alone.
It preserves the SVG viewBox dimensions and transparency. Browser dependencies
must be installed, as described in the frontend README's testing instructions.

The map contours and other illustration details are decorative, not
geographically authoritative data. Any future archival or stock replacements
should have their attribution and license requirements recorded here.
