---
status: accepted
---

# Turn Pages with a vector corner fold drawn in one Skia Canvas

A hafiz turning Pages should feel a book, not a list. So a Page Turn is a fold that follows the finger. Where you start the swipe picks the Page's top or bottom corner. That corner lifts and folds over, and the flap past the fold line is the Page mirrored across it. The target Page shows underneath, and shadows along the fold sell the curl. Swiping right turns forward, and the next Page comes in from the left as in the printed Mushaf. The fold hinges on the edge opposite the one grabbed. On a Leaf turn that edge is the spine, and the flap's back faintly shows the target Page. On the other turns it is plain paper, since a real book turns no Leaf there.

## Decision

- **One Canvas, not a list.** The horizontal FlatList is replaced by a single Skia Canvas with a gesture-handler Pan gesture. It draws three things: the target Page, the current Page clipped to the part before the fold line, and the flap. All of it is driven by Reanimated shared values on the UI thread. JS runs once per turn, when it settles, to move the Page window and update the route. Route changes jump to a Page with no fold.
- **Pages as images.** Each Page in the window is drawn once, offscreen, to an image at the screen's pixel density. A turn then redraws three images per frame. Redrawing ~150 word Paragraphs, each with its ink-weight filter, would not stay smooth on Android.
- **Every turn folds (curl on every swipe).** Forward from a right-hand Page is not a Leaf turn in a real book, since both Pages face each other. It still folds, with a plain-paper back, so every swipe feels the same.
- **Corner, not straight.** Variant A of the prototype won on the phone. The straight, spine-parallel fold (B) and today's flat slide (C) lost.
- **Tuning defaults, not rules:** the flap edge moves 1.4× the finger's travel, the corner lifts 0.18× the travel, and a turn finishes on a 700 px/s fling or past 55% of the Page width.

## Considered options

- **Runtime-shader curl over a Page image:** the most realistic, rounded bend. But it runs per pixel on every frame, which risks low-end Android, and its maths is the hardest to test. It can reuse this fold line later if a rounded bend is wanted.
- **3D `rotateY` flip:** trivial and cheap, but it looks like a card or a door swinging, not paper.
- **Spread-aware turns** (fold only on Leaf turns, slide across the spread): faithful to the book, but every other swipe would feel different.

## Consequences

- During a turn and at rest, the Page on screen is an image, not live text. That is fine while nothing is interactive. Tap, highlight and hide-for-testing (ADR 0001) will need the live drawing or word boxes above the image.
- A turn can't start until the target Page's image is ready. Right after a turn, a second one waits for the new neighbour to be drawn.
- Smoothness was judged on one Android phone in Expo Go; iOS and low-end Android are unchecked.

## Evidence

- Prototype: branch [`prototype/page-curl`](https://github.com/AxeemHaider/hafiz-quran/tree/prototype/page-curl), `src/reader/prototype/` (throwaway). Verdict: corner fold (A).
