# Triglobe illustrations

The landing page uses the original hero globe and three user-supplied SVG Repo
icons for Three Lenses.

## Active assets

| Section  | File                                    | Format                          |
| -------- | --------------------------------------- | ------------------------------- |
| Hero     | `archive/editorial-v1/hero-globe.png`   | Transparent PNG, 1200 × 1400 px |
| Politics | `building-columns-fill-svgrepo-com.svg` | SVG, `viewBox="0 0 56 56"`      |
| Business | `scale-unbalanced-svgrepo-com.svg`      | SVG, `viewBox="0 0 76 76"`      |
| Nations  | `compass-svgrepo-com.svg`               | SVG, `viewBox="0 0 24 24"`      |

Paths are relative to `client/public/images/`. The SVG files are used directly,
with no PNG conversion. Each SVG contains an SVG Repo upload comment and names
SVG Repo Mixer Tools as its generator. No individual author or license metadata
is embedded in the supplied files.

The hero's editable source remains at
`archive/editorial-v1/sources/hero-globe.svg`; original PNG checksums are recorded
in `archive/editorial-v1/checksums.json`. The archive also retains the original
coin and figure for reference; neither is displayed on the site. The previous
Politics, Business, and Nations PNGs and SVG sources have been removed from both
the active set and the archive.

## Hero replacement guidance

| Filename         | Dimensions     | Background  | Subject                      |
| ---------------- | -------------- | ----------- | ---------------------------- |
| `hero-globe.png` | 1200 × 1400 px | Transparent | Globe, newspaper, and string |

Keep the hero's 6:7 canvas ratio and transparent background. The frontend applies
`grayscale(100%) contrast(1.1)` to the image.

The map contours and other illustration details are decorative, not
geographically authoritative data. Record additional source attribution and
license information here when supplied.
