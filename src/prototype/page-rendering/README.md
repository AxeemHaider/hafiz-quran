# PROTOTYPE — page rendering (wayfinder ticket #6, map #1). Throwaway, never merge.

Question: which rendering approach reproduces page 401 (QUL page 400) faithfully on small and large phones?

Three variants on the `prototype-page-rendering` tab, switched via `?variant=`:
- **A** Skia: one Canvas per Page, one Paragraph per word, x positions computed by us.
- **B** Skia: one Canvas per Page, one Paragraph per Line, slack spread via `wordSpacing`.
- **C** RN `<Text>` per word in a `row-reverse` + `space-between` row (widths measured via onLayout first).

Run: `npm run proto:page` (copies QUL data/fonts from `sandbox/qul/` into the git-ignored `local/`, then starts Expo).
Open the "Proto" tab in Expo Go, or `hafizquran://prototype-page-rendering?variant=B`.
