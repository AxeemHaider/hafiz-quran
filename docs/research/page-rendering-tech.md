# Page rendering technology: drawing fixed-word Lines edge to edge

Research for issue #4 (map #1). Checked 2026-09-29 against Expo SDK 57 versioned docs, React Native docs, platform docs (Apple, Android/AOSP), the Skia and react-native-skia source, the CSS Text 3 spec, MDN browser-compat-data, and the source of quran_android, quran-ios, quran.com-frontend-next, DigitalKhatt and Bayaan.

Project baseline (`package.json`): `expo ~57.0.26`, `react-native 0.86.3`, `expo-font`, `expo-image`. SDK 57's `bundledNativeModules.json` pins `@shopify/react-native-skia 2.6.2`, `react-native-webview 13.16.1` and `react-native-svg 15.15.4`.

## TL;DR

- **No platform justifier stretches a single Line.** iOS/CoreText, Android `Layout`, and Skia's `SkParagraph` all leave the **last line of a paragraph** unjustified. A Line drawn as a one-line paragraph is exactly that last line. So `textAlign: 'justify'` does nothing for our case on RN `Text` and on Skia `TextAlign.Justify`. Only CSS `text-align-last: justify` (WebView) justifies a lone line.
- **Line Fidelity comes from the data, not the renderer.** If each Line is drawn from its own fixed word list and never reflowed, every option keeps the words on their Line. The real questions are: (a) how the leftover width is spread, (b) whether the natural width can overflow, and (c) whether we can get word rectangles.
- **Justification method in practice is inter-word spacing** for every option with the QUL Indopak Nastaleeq font. Kashida needs a font built for it (DigitalKhatt fonts expose it through `cvXX` OpenType features) plus a custom justifier. No browser guarantees kashida, and the QUL font is not known to support it.
- **Recommendation: `@shopify/react-native-skia` Paragraph, one Paragraph per word (or per Line with `wordSpacing`), placed at x positions we compute ourselves.** It shapes Arabic with HarfBuzz on both platforms. It measures synchronously, so fitting and geometry are pure JS math. It gives word rectangles directly and never clips tall Nastaleeq glyphs. It is in Expo Go for SDK 57. Two open-source RN Quran apps (DigitalKhatt's demo, sponsored by Tarteel, and Bayaan) already render Mushaf pages this way.
- **Runner-up: plain RN, one `<Text>` per word in a `flexDirection: 'row'` Line with `justifyContent: 'space-between'`.** This is what quran.com's web reader does in CSS flexbox. It needs no extra native dependency and gives geometry through `onLayout`. Its risks are glyph clipping and ascent/descent differences on Android, iOS/Android shaping differences, and choosing the font size without synchronous measurement.
- WebView/DOM components work (`text-align-last: justify` is supported on iOS 16+ Safari and Chrome 47+), but Expo itself advises against them for core UI. Hit-testing goes over an async bridge, and each page is a separate web engine. Pre-rendered images (quran_android/quran-ios) give perfect fidelity but a large bundle, and are fixed to whatever font rendered them.

## What every option has to solve

A Line = an ordered, fixed set of words (QUL `first_word_id..last_word_id`, including the ayah-end glyph word; see `docs/research/qul-indopak-layouts.md` on branch `research/qul-indopak-layouts`). Drawing it edge to edge at width `W` is:

1. Choose one font size `s` for the whole Page. Printed pages use one size, and per-line sizes look wrong.
2. Measure each word's advance `w_i(s)` with the real font and shaper.
3. Spread the slack `W − Σ w_i` over the `n − 1` gaps (inter-word). Alternatives: stretch letters (kashida), or scale the Line horizontally.
4. If `Σ w_i > W` for any Line at size `s`, reduce `s` for the page. A small horizontal compress (`scaleX` of about 0.97) on that Line is a fallback.
5. RTL: the first word goes at the right edge.

Because the words never reflow, **Line Fidelity is guaranteed by construction** in every option below. The exception is anything that lets the engine break lines (a multi-line paragraph, `adjustsFontSizeToFit`, CSS without `white-space: nowrap`). Treat that as a design rule: **one Line = one un-wrappable unit, sized by us**.

## Why "justify" doesn't justify one Line

| Engine | Last-line rule | Source |
|---|---|---|
| iOS CoreText (RN iOS `Text`) | `CTTextAlignment.justified`: "Text is fully justified. **The last line in a paragraph is naturally aligned.**" | developer.apple.com/documentation/coretext/cttextalignment/justified |
| Android `Layout` (RN Android `Text`) | `isJustificationRequired(line)` returns true only when `lineEnd < mText.length()`, so the final line is never justified | AOSP `core/java/android/text/Layout.java` (`isJustificationRequired`) |
| Skia `SkParagraph` (RN Skia `Paragraph`) | `TextLine::format` justifies only `if (!this->endsWithHardLineBreak())`, and `endsWithHardLineBreak()` is true for the last line ("For some reason Flutter imagines a hard line break at the end of the last line"). An RTL last line is right-aligned instead. | google/skia `modules/skparagraph/src/TextLine.cpp` |
| CSS | `text-align-last: justify` explicitly justifies the last/only line | CSS Text 3 §6.2; MDN BCD: Chrome 47+, Safari 16+ (iOS mirrors) |

Tricks that add a hidden second line to "justify" the first are fragile and still give you no word geometry. Every native option below therefore does its own inter-word math.

## Option 1: React Native `Text`

**Docs (reactnative.dev, Text / Text Style Props):**
- `textAlign: 'justify'`: "On Android, the value 'justify' is only supported on Oreo (8.0) or above (API level >= 26)." It is inter-word on Android (`LineBreaker.JUSTIFICATION_MODE_INTER_WORD` "justified by stretching word spacing"). `JUSTIFICATION_MODE_INTER_CHARACTER` (API 35) stretches letter spacing, which would break Arabic joins. It is not exposed by RN anyway. As shown above, justify has no effect on a single Line.
- `adjustsFontSizeToFit`: "Specifies whether fonts should be scaled down automatically to fit given style constraints", with `minimumFontScale`. It only shrinks, and each `Text` shrinks on its own, so Lines would end up at different sizes. Not usable for a uniform Page.
- `onTextLayout` returns per *line* metrics (`x, y, width, height, ascender, descender, capHeight, xHeight`), not per word. RN has no synchronous text-measure API.

**Workable design (runner-up):** each Line is a `View` with `flexDirection: 'row'` (RTL via `direction: 'rtl'`/`row-reverse`) and `justifyContent: 'space-between'`. Each word is its own `<Text numberOfLines={1}>`.
- *Justification:* inter-word, done by flexbox (Yoga), so no platform justifier is involved. This is the same method quran.com uses on the web (below).
- *Fidelity:* guaranteed by structure. The only failure is overflow when `Σ w_i > W`.
- *Font size:* must be chosen before layout. Options: (a) precompute word advances offline in font units with HarfBuzz (fixed font + fixed words, so `w_i(s) = adv_i · s / unitsPerEm`), or (b) do a hidden measuring pass with `onLayout`/`onTextLayout`, then re-render. (a) is deterministic but assumes CoreText/Minikin shape like HarfBuzz. The flexbox slack absorbs small differences, but not overflow.
- *Geometry:* `onLayout` per word Text (async), or computed from the offline advances. Hiding a word = `opacity: 0` (keeps its slot). Highlight = background/overlay View.
- *Custom font:* `expo-font` (Expo Go OK).
- *Performance:* about 16 Lines × about 10 words ≈ 150–200 `Text` views per page. With a windowed pager (3 pages mounted) that is fine. Needs measuring on low-end Android.
- *Risks:* Nastaleeq glyphs have tall ascenders and deep descenders, and marks overhang past the advance box. RN `Text` on Android can clip ink outside the line box (`includeFontPadding`, `lineHeight`). iOS and Android shape and measure differently, so the same Page looks slightly different on each. No kashida.

## Option 2: `react-native-webview` / Expo DOM components with CSS

**Docs:** `react-native-webview` is in Expo Go for SDK 57 (docs.expo.dev/versions/v57.0.0/sdk/webview). Expo DOM components (`'use dom'`) now use `@expo/dom-webview` by default. Expo's guide says: "We recommend building truly native apps using universal primitives… DOM components only support standard JavaScript, which is slower to parse and start up than optimized Hermes bytecode". It also says data crosses only "through an asynchronous JSON transport system" and that function props "cannot return values synchronously" (docs.expo.dev/guides/dom-components).

- *Justification:* `text-align-last: justify` on a `white-space: nowrap` Line, or flex `space-between` per word as quran.com does. `text-justify` (inter-word/inter-character) is Chrome 145+ only and **not supported in Safari** (MDN BCD, WebKit bug 99945). CSS Text 3 §6.4.4 "Cursive Scripts": justification "must not introduce gaps between the joined typographic letter units of cursive scripts such as Arabic". It adds that the UA "**may** translate space… into some form of cursive elongation". Kashida is optional, so in practice you get inter-word spacing.
- *Fitting:* easy. CSS can measure synchronously inside the page (`getBoundingClientRect`), and `vw`/`vh` units can fit a Page to the viewport.
- *Geometry:* excellent inside the web view (spans per word). Taps and highlights go through async `postMessage` to RN.
- *Custom font:* `@font-face` from a bundled file (file:// in release builds).
- *Performance:* one web engine per mounted page, or one web view holding its own pager. Memory, start-up cost and gesture interop with native paging are the known costs. Expo lists low-power frame throttling as a caveat for web content.
- *Fit for this app:* credible fallback, and closest to how QUL, quran.com and DigitalKhatt already render on the web. It goes against Expo's guidance for primary UI and makes later hit-testing features async.

## Option 3: `@shopify/react-native-skia` (recommended)

**Expo:** "Included in Expo Go: Yes", platforms android/ios, install with `npx expo install @shopify/react-native-skia` (docs.expo.dev/versions/v57.0.0/sdk/skia). The SDK 57 pin is 2.6.2.

**Shaping:** the build config (`packages/skia/scripts/skia-configuration.ts`) builds the Paragraph module with `skia_use_harfbuzz: true` (bundled, not system) on both platforms. Unicode support comes from ICU on Android and from libgrapheme plus Skia's ICU-subset bidi on Apple (`SkUnicode_libgrapheme.cpp` uses `SkBidiSubsetFactory`). The low-level `<Text>`/`drawText` path calls `canvas->drawSimpleText` (`cpp/api/JsiSkCanvas.h`), which does **no shaping**, so Arabic will not join. **Use the Paragraph API only.**

**Paragraph API** (`apps/docs/docs/text/paragraph.md`, `src/skia/types/Paragraph/Paragraph.ts`):
- Custom fonts via `useFonts({ Family: [require('…ttf')] })` → font manager → `Skia.ParagraphBuilder.Make(style, fontMgr)`.
- Paragraph style: `textAlign`, `textDirection` (RTL), `maxLines`, `strutStyle`, `heightMultiplier`. Text style: `fontSize`, `fontFeatures`, `fontVariations`, **`wordSpacing`**, `letterSpacing`, `color`, `backgroundColor`.
- Synchronous measurement: `layout(width)`, `getMaxIntrinsicWidth()`, `getLongestLine()`, `getLineMetrics()`.
- Geometry: `getRectsForRange(start,end)`, `getGlyphPositionAtCoordinate(x,y)`, `getPath(line)` (ink bounds; not on web), and `extendedVisit()` (per-glyph ids, positions, tight bounds).

**Design:**
- (a) **Per-word paragraphs:** build one Paragraph per word, read `getMaxIntrinsicWidth()`, compute `s` for the page and the gap, then `<Paragraph x={…}>` each word from right to left. Word rectangles are known exactly, and hide/highlight are per-word draw decisions.
- (b) **Per-Line paragraph + `wordSpacing`:** set `wordSpacing = (W − natural)/(gaps)` and lay out at a very wide width so it never wraps. Geometry comes via `getRectsForRange`.
- *Justification:* inter-word by default. Kashida is possible only if the font exposes elongation features. DigitalKhatt's RN demo sets per-character `fontFeatures` (`cv01`, `cv02`… in `just.service.ts`) and per-space `letterSpacing` to justify the Madina font.
- *Fidelity:* by construction. Shaping is HarfBuzz on both platforms, so **iOS and Android get identical widths**, which the native `Text` option can't guarantee.
- *Performance:* no native views per word, so one Canvas per Page. Building about 200 small paragraphs per page takes milliseconds, and results can be cached per (page, width). Bayaan reports DK layout computation of ~20–100 ms/page on first run, then caches all pages in MMKV (<1 ms reads) (`docs/features/digital-khatt/rendering-pipeline.md`). Plain inter-word math is simpler than DK's. Keep a windowed pager with 3 Canvases mounted.
- *Hit-testing:* the Canvas plus `react-native-gesture-handler`, mapping tap x/y to our word rectangles (Bayaan uses `getGlyphPositionAtCoordinate` on long-press).
- *Risks:* native binary size of Skia (measure in the prototype). Paragraph metrics reserve full font ascent/descent, so tall Nastaleeq lines need line spacing from the page grid, not from paragraph height. The Skia Canvas is a custom surface, so accessibility (screen readers) needs separate work.

## Option 4: other approaches

- **Pre-rendered page or line images plus coordinate DB.** quran_android draws full-page PNGs (`"page" + nf.format(p) + ".png"` in `QuranFileUtils.kt`), with word/ayah geometry from `ayahinfo_$width.db`. Its newer *line-by-line* mode draws one image per Line, scaled to width in Compose (`QuranLine.kt`: `drawImage(... dstSize = IntSize(totalWidth, lineHeight))`). Word highlights come from the `ayah_glyphs` table (`page, line, sura, ayah, glyph_position, left, right`). quran-ios does the same (`ayahinfo_\(width).db`, `WordFrame`). Fidelity is perfect and cross-platform identical. Hiding words = drawing a background rectangle over the word box. The costs: 548 page images must be bundled for offline use (large), they blur or alias across densities unless you ship several widths, and they are tied to one rendering of one font. We would have to produce them ourselves from the QUL font, so they're an output of Option 3 run offline, not an alternative to it. `expo-image` can display them in Expo Go.
- **SVG per page** (`react-native-svg`, in Expo Go): glyph outlines as paths, precomputed offline with HarfBuzz. It is resolution-independent and exact, but 548 large SVGs are heavy to parse and render as React trees. Skia can draw the same paths more cheaply. It only makes sense if runtime font shaping proves unreliable.

## How existing apps do it

| App | Technology | Justification | Geometry source |
|---|---|---|---|
| **quran_android** | Page PNGs (classic); per-Line images in Compose (line-by-line) | Baked into images | `ayahinfo_<width>.db`; `ayah_glyphs(left,right)` per word |
| **quran-ios** | Page images | Baked in | `ayahinfo_<width>.db` → `WordFrame` |
| **quran.com-frontend-next** (web) | DOM + per-page QCF fonts (`QCF_P###`, `QCF2###`, `QCF4_P###` via `FontFace`, `fontFaceHelper.ts`). IndoPak 15/16-line uses a text font. | Each Line has a fixed `inline-size: var(--line-width)` (width tables per font and scale in `_utility.scss`), and words are a flex row with **`justify-content: space-between`** (`VerseText.module.scss`) | DOM spans per word |
| **Tarteel** | Closed source. Tarteel sponsors DigitalKhatt ("This project is sponsored by @tarteelAI" in DigitalKhatt READMEs) and runs QUL. | Not publicly documented | n/a |
| **DigitalKhatt/mushaf-react-native** (MIT) | RN Skia Paragraph per Line | Kashida via DK font `cvXX` features plus per-space `letterSpacing` | Paragraph APIs |
| **thebayaan/Bayaan** | RN Skia 2.2 (DigitalKhatt fonts), also a QCF path | DK justifier; layouts cached in MMKV | `getGlyphPositionAtCoordinate` → verse by char index |
| alop-hue/noor (Expo) | RN `Text` with `textAlign: 'justify'`, flowing text | Not Line-faithful | n/a |

DigitalKhatt also publishes an **IndoPak** font (`DigitalKhatt/indopakfont`, "based on Quraan Al Majeed 13 lines IndoPak Mushaf") and has 15-line IndoPak text in `digitalkhatt-js`. It is a possible kashida-capable font for later, but it is not the Taj calligraphy or the QUL `text_indopak_nastaleeq` encoding. That's a matter for the font ticket.

## Comparison

| | RN `Text` per word + flex | WebView / DOM | **Skia Paragraph** | Pre-rendered images |
|---|---|---|---|---|
| Line Fidelity | By construction (overflow risk) | By construction (`nowrap`) | By construction | Perfect |
| Justify method | Inter-word (flex) | Inter-word (`text-align-last`/flex); kashida optional per spec and not relied on | Inter-word (`wordSpacing`/x positions); kashida only with a DK-style font | Baked |
| Same look iOS/Android | No (CoreText vs Minikin) | No (WebKit vs Blink) | **Yes (bundled HarfBuzz)** | Yes |
| Synchronous measure for fitting | No | Yes (inside web) | **Yes** | n/a |
| Per-word geometry | `onLayout` (async) or offline | DOM (async bridge to RN) | **Direct, synchronous** | Offline DB |
| Hide/highlight word | opacity/overlay | CSS | Draw decision | Mask rectangle |
| Glyph clipping risk | Yes (Android) | Low | None | None |
| Expo Go (SDK 57) | Yes | Yes | Yes | Yes |
| Bundle cost | Font only | Font + HTML | Font + Skia native libs | 548 images (large) |

## Recommendation

1. **Skia Paragraph, per-word placement, one Canvas per Page.** Compute one font size per Page as `min over Lines of W / Σ w_i` (with a floor/cap for tablets), spread the remaining slack between words, and anchor RTL at the right edge. Surah-name and bismillah Lines are centred (`is_centered`). Keep word rectangles in a per-page model for later tap/highlight/hide features.
2. **Runner-up: RN `Text` per word inside flex `space-between` Lines**, with word advances precomputed offline by HarfBuzz to pick the font size. Choose this if Skia's binary size or accessibility cost is unacceptable.

Not recommended: `textAlign: 'justify'` or `adjustsFontSizeToFit` on a whole-Line `Text` (no-op for single Lines, and per-Line sizes differ), Skia's `<Text>`/`drawText` (no shaping), WebView as the primary renderer.

## What the prototype must verify

1. QUL **Indopak Nastaleeq** font (font/242) shapes correctly in Skia Paragraph on **both** iOS and Android, including the PUA ayah-number glyphs (U+F4FF + n), U+06DF end marks, waqf and ruku marks. Compare with `docs/QuranPage.jpg` (QUL page 400).
2. **Page 400 fits** a small portrait phone (e.g. 360×640 dp) with no scroll. Record the chosen font size, the worst Line's natural-width ratio, and whether any Line needs `scaleX` compression, across a sample of dense pages.
3. **Vertical metrics:** tall Nastaleeq ascenders/descenders and stacked marks don't collide or clip at 16 Lines per page height. Compare paragraph metrics with ink bounds from `getPath`.
4. **Performance:** time to build and draw one page on a low-end Android device. Check swipe smoothness in a pager with 3 mounted Canvases, and memory while flipping through 50+ pages.
5. **Hit-testing:** tap → word id → ayah, and toggling a word's visibility without re-laying out the Line.
6. **Size:** app binary delta from adding Skia, plus font size.
7. Optional: build the same page with RN `Text` + flex to measure clipping and cross-platform drift against the runner-up.

## Sources

- Expo SDK 57: https://docs.expo.dev/versions/v57.0.0/sdk/skia.md, https://docs.expo.dev/versions/v57.0.0/sdk/webview.md, https://docs.expo.dev/guides/dom-components.md, `expo/expo@sdk-57 packages/expo/bundledNativeModules.json`, https://docs.expo.dev/llms.txt
- React Native: https://reactnative.dev/docs/text (`adjustsFontSizeToFit`, `minimumFontScale`, `onTextLayout`, `TextLayout`), https://reactnative.dev/docs/text-style-props (`textAlign`)
- Apple: https://developer.apple.com/documentation/coretext/cttextalignment/justified, https://developer.apple.com/documentation/uikit/nstextalignment/justified
- Android: https://developer.android.com/reference/android/graphics/text/LineBreaker (justification modes); AOSP `frameworks/base/core/java/android/text/Layout.java` (`isJustificationRequired`)
- Skia: `google/skia` `modules/skparagraph/src/TextLine.cpp` (`format`, `justify`, `endsWithHardLineBreak`), `ParagraphImpl.cpp`, `modules/skunicode/src/SkUnicode_libgrapheme.cpp`
- react-native-skia (`Shopify/react-native-skia` main, 2026-09-29): `apps/docs/docs/text/paragraph.md`, `text.md`; `packages/skia/src/skia/types/Paragraph/Paragraph.ts`; `packages/skia/scripts/skia-configuration.ts`; `packages/skia/cpp/api/JsiSkCanvas.h`; `packages/skia/react-native-skia.podspec`
- CSS: https://www.w3.org/TR/css-text-3/ §6.4.4, §7.2.1; MDN browser-compat-data `css/properties/text-align-last.json`, `text-justify.json`
- quran_android: `common/linebyline/ui/.../QuranLineLayout.kt`, `feature/linebyline/.../ui/QuranLine.kt`, `common/linebyline/data/.../AyahGlyphs.sq`, `app/.../util/QuranFileUtils.kt`
- quran-ios: `Model/QuranKit/Sources/Reading.swift`, `Model/QuranGeometry/Sources/WordFrame.swift`
- quran.com-frontend-next (`production`): `src/components/QuranReader/ReadingView/Line.tsx`, `Line.module.scss`, `src/components/Verse/VerseText.module.scss`, `src/styles/_utility.scss`, `src/utils/fontFaceHelper.ts`
- DigitalKhatt: https://github.com/DigitalKhatt/mushaf-react-native (`just.service.ts`, `line.tsx`), https://github.com/DigitalKhatt/indopakfont, https://github.com/DigitalKhatt/digitalkhatt-js
- Bayaan: https://github.com/thebayaan/Bayaan (`README.md`, `docs/features/digital-khatt/rendering-pipeline.md`)
- Noor: https://github.com/alop-hue/noor `src/components/quran/MushafReader.tsx`
- QUL: https://qul.tarteel.ai/docs/mushaf-layout (only centred-line sample code; no justify technique documented)
