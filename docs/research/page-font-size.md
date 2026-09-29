# How much does one font size for the whole Mushaf cost?

Measured 2026-09-30 for issue #7 (map: #1), to choose between one font size per Page and one size for the whole Mushaf.

## Method

HarfBuzz (uharfbuzz 0.51.7) shaped every `ayah` Line of the QUL Taj 16-line layout (548 Pages), using the QUL Indopak Nastaleeq script and font `B-hanafi-normal.ttf`, with gap 0. A Line's width is the sum of its words' advances, in em. A Page's longest Line caps the font size, so a smaller cap means bigger text. The widening factor is how far a non-centred Line's words must be stretched sideways to fill the width at the chosen size.

## Results

| Size rule | Page 400 size (relative to its own cap) | Widening: median / p90 / max |
|---|---|---|
| Per Page (the prototype) | 1.00 | 1.11 / 1.22 / 1.80 |
| One size, set by the longest Line in the Mushaf (19.24 em, Page 339) | 0.886 | 1.35 / 1.49 / 2.25 |
| **One size for Lines up to 18 em; longer Pages shrink to fit themselves** | **0.948** | **1.26 / 1.39 / 2.11** |

- Longest Line per Page: median 15.88 em, p10 14.88, p90 17.18. Page 400 (printed 401): 17.06 em.
- Only 8 Pages have a Line over 18 em: 73, 270, 284, 339, 342, 451, 459, 469. Only 2 have one over 19 em.
- At 360 dp width the per-Page size for Page 400 is about 20 dp (from #6), so the 18 em rule gives about 19 dp.
