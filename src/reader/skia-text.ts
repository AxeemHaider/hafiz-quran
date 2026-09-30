import { Skia, TextDirection, type SkParagraph, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useEffect } from 'react';

import type { Measure } from '@/layout';

/** The one family name the Mushaf font is registered under. Nothing depends on which font it is. */
export const MUSHAF_FONT_FAMILY = 'MushafFont';

export const INK_COLOR = '#1a1a1a';
/**
 * Extra ink weight, in em: every glyph's ink is grown (dilated) by this much on each side, since the
 * font comes in one weight and the Taj print is heavier. Advances don't change, so neither does the layout.
 */
const INK_WEIGHT_EM = 0.015;
/** Lay out on one line, far wider than any word. */
const UNBOUNDED_WIDTH = 1e5;
/** Slack so a text laid out at its own width never wraps. */
const WIDTH_SLACK = 2;

/** One word as its own RTL Paragraph, laid out and ready to measure or draw. */
export function makeWordParagraph(fontMgr: SkTypefaceFontProvider, text: string, fontSize: number): SkParagraph {
  const ink = Skia.Paint();
  ink.setColor(Skia.Color(INK_COLOR));
  const grow = INK_WEIGHT_EM * fontSize;
  ink.setImageFilter(Skia.ImageFilter.MakeDilate(grow, grow));
  const paragraph = Skia.ParagraphBuilder.Make({ textDirection: TextDirection.RTL }, fontMgr)
    .pushStyle({ fontFamilies: [MUSHAF_FONT_FAMILY], fontSize, color: Skia.Color(INK_COLOR) }, ink)
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

/** A laid-out Paragraph and where to draw it: `<Paragraph x y width>`. */
export type PlacedText = { paragraph: SkParagraph; x: number; y: number; width: number };

export type TextPlacement = {
  fontSize: number;
  /** Middle of the font's ink above the baseline, in em; it is centred on `centerY`. */
  inkCenterEm: number;
  centerY: number;
  /** Where the text's right edge goes, given its width. */
  rightEdge: number | ((textWidth: number) => number);
  /** The text's width, if already measured; otherwise the Paragraph's own. */
  textWidth?: number;
};

/**
 * One text as an RTL Paragraph, placed by its right edge and ink centre. An RTL Paragraph right-aligns
 * inside its layout width, so its right edge lands on `rightEdge`. Dispose the Paragraph when done
 * (`useDisposeTexts`).
 */
export function placeText(
  fontMgr: SkTypefaceFontProvider,
  text: string,
  { fontSize, inkCenterEm, centerY, rightEdge, textWidth }: TextPlacement,
): PlacedText {
  const paragraph = makeWordParagraph(fontMgr, text, fontSize);
  const measured = textWidth ?? paragraph.getMaxIntrinsicWidth();
  const width = Math.ceil(measured) + WIDTH_SLACK;
  const baseline = paragraph.getLineMetrics()[0]?.baseline ?? 0;
  const right = typeof rightEdge === 'number' ? rightEdge : rightEdge(measured);
  return { paragraph, x: right - width, y: centerY + inkCenterEm * fontSize - baseline, width };
}

/** Disposes placed texts' Paragraphs when they are replaced or unmounted. */
export function useDisposeTexts(texts: readonly PlacedText[]) {
  useEffect(() => () => texts.forEach((t) => t.paragraph.dispose()), [texts]);
}
