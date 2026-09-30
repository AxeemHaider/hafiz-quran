import { Skia, TextDirection, type SkParagraph, type SkTypefaceFontProvider } from '@shopify/react-native-skia';

import type { Measure } from '@/layout';

/** The one family name the Mushaf font is registered under. Nothing depends on which font it is. */
export const MUSHAF_FONT_FAMILY = 'MushafFont';

export const INK_COLOR = '#1a1a1a';
/** Lay out on one line, far wider than any word. */
const UNBOUNDED_WIDTH = 1e5;

/** One word as its own RTL Paragraph, laid out and ready to measure or draw. */
export function makeWordParagraph(fontMgr: SkTypefaceFontProvider, text: string, fontSize: number): SkParagraph {
  const paragraph = Skia.ParagraphBuilder.Make({ textDirection: TextDirection.RTL }, fontMgr)
    .pushStyle({ fontFamilies: [MUSHAF_FONT_FAMILY], fontSize, color: Skia.Color(INK_COLOR) })
    .addText(text)
    .build();
  paragraph.layout(UNBOUNDED_WIDTH);
  return paragraph;
}

/**
 * The text measurer handed to the Page layout: Skia Paragraph measurement with the loaded font, so the
 * device measures with the same shaper it draws with. Widths are cached by size and text, since words
 * repeat across Pages.
 */
export function makeSkiaMeasure(fontMgr: SkTypefaceFontProvider): Measure {
  const cache = new Map<string, number>();
  return (text, fontSize) => {
    const key = `${fontSize}|${text}`;
    let width = cache.get(key);
    if (width === undefined) {
      const paragraph = makeWordParagraph(fontMgr, text, fontSize);
      width = paragraph.getMaxIntrinsicWidth();
      paragraph.dispose();
      cache.set(key, width);
    }
    return width;
  };
}
