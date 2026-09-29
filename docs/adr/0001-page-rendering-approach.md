---
status: accepted
---

# Draw each Page with Skia, one Paragraph per word, laid out by us

Huffaz need **Line Fidelity**: every Line starts and ends on the printed word. The Line must also fill the width edge to edge on any phone, and the whole Page must fit without scrolling. We draw each Page as one `@shopify/react-native-skia` Canvas. Every word is its own Paragraph, and we compute the positions ourselves from the **QUL Taj 16-line Mushaf Layout**. The font is **QUL Indopak Nastaleeq (normal build)**. Built-in text justify can't give this: on iOS, Android and Skia alike it never stretches a single Line. Our own layout also gives us each word's rectangle for tap, highlight and hide-for-testing later.

## Decision

- **Mushaf Layout:** QUL "Indopak 16 lines layout (Taj company)". It is SQLite, one row per Line with a first and last word id, over QUL's Indopak Nastaleeq word-by-word script. It matches the printed Taj page line for line. The renderer reads *any* layout of this shape. The Qudratullah 15-line layout has the same shape and can come later as data, but it has not been rendered yet.
- **Font:** QUL Indopak Nastaleeq, normal build (QuranWBW "AlQuran IndoPak"). It is one file for the whole Quran and the only close match to the Taj reference. The font must stay **swappable**: the layout uses only measured glyph widths and ink height, never constants specific to this font. Fallback: Digital Khatt IndoPak (SIL OFL).
- **Drawing method:** words are placed right to left with no gap between them. A justified Line is filled by **widening its words sideways** (a per-Line horizontal scale), not by widening the gaps. Words are **stretched vertically** around the Line's centre. Line height is fitted to the font's **ink** height, not its line height.
- **Scaling rule:** **one font size for the whole Mushaf on a given screen**. It is the largest size at which Lines up to a cut-off width fit, and at which the Lines fit the height. The few Pages with longer Lines shrink to fit themselves. A hafiz memorises by where words sit, so the same word shouldn't change size from Page to Page.
- **Tuning defaults, not rules:** gap 0, vertical stretch 1.3×, width cut-off 18 em. With 18 em, 540 of 548 Pages share one size. Page 400 (printed 401) is drawn at about 0.95 of its own best fit (≈19 dp at 360 dp), and the median widening is about 1.26×. See [page-font-size](../research/page-font-size.md).

## Considered options

- **RN `Text`, one per word in a row:** the runner-up. It needs an async onLayout measuring pass before a Page can be sized, and Arabic shaping differs by platform.
- **Skia, one Paragraph per Line with `wordSpacing`:** also stretches spaces *inside* a word (e.g. `سَلٰمٌ ۫`).
- **Filling Lines by widening the gaps:** Lines with few words showed large holes. The Taj print fills Lines by widening the calligraphy.
- **WebView, or photos of the printed Pages:** WebView was ruled out as the main renderer. Photos give the exact look but reopen the bundle-size and rights questions, and lose word geometry.
- **One size per Page (as prototyped):** largest text, but the size changes as you swipe. **One size set by the Mushaf's longest Line (Page 339):** fully uniform, but everything is 11% smaller and a typical Line is widened 1.35×.
- **Digital Khatt IndoPak now:** clean licence, but a worse match, with rosette ayah markers, and it is v0.1.

No available font reproduces the Taj hand calligraphy. Its words are narrow and tall, while these fonts write long and flat. Widening words and stretching them vertically is our best-effort way to get close, and the human judged the result close enough.

## Consequences

These are **unverified**. Each should become an early check during implementation.

- **iOS parity:** judged on one Android phone only. Ayah-end numbers (private-use glyphs) and waqf marks are unchecked on iOS.
- **Low-end Android:** Page build time and swipe smoothness were not measured.
- **Tall marks:** at a 1.3× stretch, marks may cross into neighbouring Lines. Only Page 400 was seen. Lowering the stretch is the planned fix.
- **App size:** Skia's cost was not measured. Expo Go includes Skia, so measuring needs a development build.
- **Licences block public release:** QUL shows no licence for the layout data or script. The font needs written permission from quranwbw.com. If the font is refused, switch to Digital Khatt IndoPak, then re-tune and re-judge.
- **Accessibility:** a Skia canvas is invisible to screen readers, so the Page's text must be exposed another way.

## Evidence

- [QUL Indopak layouts](../research/qul-indopak-layouts.md) · [QUL Indopak fonts](../research/qul-indopak-fonts.md) · [Rendering technology](../research/page-rendering-tech.md) · [Font size across Pages](../research/page-font-size.md)
- Prototype: branch [`prototype/page-rendering`](https://github.com/AxeemHaider/hafiz-quran/tree/prototype/page-rendering), `src/prototype/page-rendering/README.md` (throwaway). Verdict in issue #6.
